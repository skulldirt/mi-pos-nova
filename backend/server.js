const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcrypt');

const app = express();

app.use(cors());
app.use(express.json());

let db;

// Conexión y Creación de Tablas
(async () => {
    db = await open({
        filename: './pos.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            rol TEXT
        );
        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precio REAL NOT NULL,
            stock INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS detalle_ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venta_id INTEGER,
            producto_id INTEGER,
            cantidad INTEGER,
            precio_unitario REAL,
            FOREIGN KEY(venta_id) REFERENCES ventas(id),
            FOREIGN KEY(producto_id) REFERENCES productos(id)
        );
    `);
    console.log("✅ Base de datos lista");
    
    // Script de seguridad: Crear un admin por defecto si la tabla está vacía
    const adminExists = await db.get('SELECT * FROM usuarios WHERE username = ?', ['admin']);
    if (!adminExists) {
        const hash = await bcrypt.hash('1234', 10);
        await db.run('INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)', ['admin', hash, 'admin']);
        console.log("👤 Usuario admin por defecto creado (admin/1234)");
    }
})();

// --- RUTAS DE USUARIOS ---

app.post('/register', async (req, res) => {
    const { username, password, rol } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        await db.run('INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)', 
            [username, hash, rol || 'cajero']);
        res.send({ mensaje: "Usuario registrado con éxito" });
    } catch (e) {
        res.status(400).send({ error: "El usuario ya existe o faltan datos" });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db.get('SELECT * FROM usuarios WHERE username = ?', [username]);
        if (user && await bcrypt.compare(password, user.password)) {
            res.send({ mensaje: "Entrada permitida", rol: user.rol, username: user.username });
        } else {
            res.status(401).send({ error: "Usuario o contraseña incorrectos" });
        }
    } catch (e) {
        res.status(500).send({ error: "Error en el servidor" });
    }
});

// --- RUTAS DE PRODUCTOS ---

app.get('/productos', async (req, res) => {
    const productos = await db.all('SELECT * FROM productos');
    res.json(productos);
});

app.post('/productos', async (req, res) => {
    try {
        const { nombre, precio, stock } = req.body;
        const p = parseFloat(precio);
        const s = parseInt(stock);

        if (!nombre || isNaN(p) || isNaN(s)) {
            return res.status(400).send({ error: "Datos inválidos" });
        }

        await db.run('INSERT INTO productos (nombre, precio, stock) VALUES (?, ?, ?)', [nombre, p, s]);
        res.send({ mensaje: "Producto guardado" });
    } catch (error) {
        res.status(500).send({ error: "Error interno" });
    }
});

app.put('/productos/:id', async (req, res) => {
    const { nombre, precio, stock } = req.body;
    const { id } = req.params;
    await db.run('UPDATE productos SET nombre = ?, precio = ?, stock = ? WHERE id = ?', [nombre, precio, stock, id]);
    res.send({ mensaje: "Actualizado" });
});

app.delete('/productos/:id', async (req, res) => {
    await db.run('DELETE FROM productos WHERE id = ?', [req.params.id]);
    res.send({ mensaje: "Eliminado" });
});

// --- RUTAS DE VENTAS (CON TRANSACCIONES) ---

app.post('/ventas', async (req, res) => {
    const { carrito } = req.body; 
    let totalVenta = 0;
    try {
        await db.run('BEGIN TRANSACTION');
        const result = await db.run('INSERT INTO ventas (total) VALUES (0)');
        const ventaId = result.lastID;

        for (const item of carrito) {
            const producto = await db.get('SELECT * FROM productos WHERE id = ?', [item.id]);
            if (!producto || producto.stock < item.cantidad) {
                throw new Error(`Stock insuficiente para: ${producto?.nombre || 'ID ' + item.id}`);
            }
            totalVenta += producto.precio * item.cantidad;
            await db.run('INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
                [ventaId, item.id, item.cantidad, producto.precio]);
            await db.run('UPDATE productos SET stock = stock - ? WHERE id = ?', [item.cantidad, item.id]);
        }

        await db.run('UPDATE ventas SET total = ? WHERE id = ?', [totalVenta, ventaId]);
        await db.run('COMMIT');
        res.send({ mensaje: "Venta exitosa", total: totalVenta });
    } catch (error) {
        await db.run('ROLLBACK');
        res.status(400).send({ error: error.message });
    }
});

app.get('/ventas', async (req, res) => {
    const ventas = await db.all('SELECT * FROM ventas ORDER BY fecha DESC');
    res.json(ventas);
});

// --- UTILIDADES ---

app.get('/reset-usuarios', async (req, res) => {
    await db.run('DELETE FROM usuarios');
    res.send({ mensaje: "Usuarios eliminados" });
});

// Ruta de salud para Render (opcional pero recomendada)
app.get('/', (req, res) => res.send("Servidor POS NOVA Online 🚀"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor en puerto ${PORT}`);
});