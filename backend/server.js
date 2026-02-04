const express = require('express');
const cors = require('cors'); // <--- 1. Importa CORS
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcrypt');

const app = express();

app.use(cors()); // <--- 2. ¡ESTA ES LA LÍNEA MÁGICA! Permite todas las conexiones
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
        rol TEXT -- 'admin' o 'cajero'
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
    console.log("✅ Base de datos lista y tabla 'productos' creada.");
})();
// RUTA 0: USUARIOS
app.post('/registrar-admin', async (req, res) => {
    const { username, password } = req.body;
    const hash = await bcrypt.hash(password, 10); // Cifra la contraseña
    
    try {
        await db.run('INSERT INTO usuarios (username, password, rol) VALUES (?, ?, ?)', 
        [username, hash, 'admin']);
        res.send({ mensaje: "Usuario administrador creado" });
    } catch (e) {
        res.status(400).send({ error: "El usuario ya existe" });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await db.get('SELECT * FROM usuarios WHERE username = ?', [username]);

    if (user && await bcrypt.compare(password, user.password)) {
        res.send({ mensaje: "Entrada permitida", rol: user.rol, username: user.username });
    } else {
        res.status(401).send({ error: "Usuario o contraseña incorrectos" });
    }
});

// RUTA 1: Agregar un producto
app.post('/productos', async (req, res) => {
    const { nombre, precio, stock } = req.body;
    await db.run(
        'INSERT INTO productos (nombre, precio, stock) VALUES (?, ?, ?)',
        [nombre, precio, stock]
    );
    res.send({ mensaje: "Producto guardado con éxito" });
});

// RUTA 2: Ver inventario
app.get('/productos', async (req, res) => {
    const productos = await db.all('SELECT * FROM productos');
    res.json(productos);
});

// RUTA 3: Actualizar un producto (Editar precio o stock manualmente)
app.put('/productos/:id', async (req, res) => {
    const { nombre, precio, stock } = req.body;
    const { id } = req.params;
    
    await db.run(
        'UPDATE productos SET nombre = ?, precio = ?, stock = ? WHERE id = ?',
        [nombre, precio, stock, id]
    );
    res.send({ mensaje: "Producto actualizado correctamente" });
});

// RUTA 4: Eliminar un producto
app.delete('/productos/:id', async (req, res) => {
    const { id } = req.params;
    await db.run('DELETE FROM productos WHERE id = ?', [id]);
    res.send({ mensaje: "Producto eliminado" });
});

//RUTA 5: Prosesar Ventas
app.post('/productos', async (req, res) => {
    try {
        // Forzamos la conversión a números para evitar errores de tipo
        const nombre = req.body.nombre;
        const precio = parseFloat(req.body.precio);
        const stock = parseInt(req.body.stock);

        if (!nombre || isNaN(precio) || isNaN(stock)) {
            return res.status(400).send({ error: "Datos inválidos o faltantes" });
        }

        await db.run(
            'INSERT INTO productos (nombre, precio, stock) VALUES (?, ?, ?)',
            [nombre, precio, stock]
        );
        res.send({ mensaje: "Producto guardado con éxito" });
    } catch (error) {
        console.error("Error en el servidor:", error);
        res.status(500).send({ error: "Error interno del servidor" });
    }
});

// RUTA PARA PROCESAR VENTAS
app.post('/ventas', async (req, res) => {
    const { carrito } = req.body; 
    let totalVenta = 0;

    try {
        await db.run('BEGIN TRANSACTION');

        // 1. Crear el registro de la venta
        const result = await db.run('INSERT INTO ventas (total) VALUES (0)');
        const ventaId = result.lastID;

        for (const item of carrito) {
            // 2. Obtener datos actuales del producto
            const producto = await db.get('SELECT * FROM productos WHERE id = ?', [item.id]);
            
            if (!producto || producto.stock < item.cantidad) {
                throw new Error(`Stock insuficiente para: ${producto ? producto.nombre : 'ID ' + item.id}`);
            }

            const subtotal = producto.precio * item.cantidad;
            totalVenta += subtotal;

            // 3. Registrar el detalle
            await db.run(
                'INSERT INTO detalle_ventas (venta_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
                [ventaId, item.id, item.cantidad, producto.precio]
            );

            // 4. Restar del stock
            await db.run('UPDATE productos SET stock = stock - ? WHERE id = ?', [item.cantidad, item.id]);
        }

        // 5. Actualizar el total de la factura
        await db.run('UPDATE ventas SET total = ? WHERE id = ?', [totalVenta, ventaId]);

        await db.run('COMMIT');
        res.send({ mensaje: "Venta exitosa", total: totalVenta });

    } catch (error) {
        await db.run('ROLLBACK'); // Si algo falla, deshacemos todo para no perder dinero ni stock
        console.error("Error en transacción:", error.message);
        res.status(400).send({ error: error.message });
    }
});

// RUTA 6: Ver historial de ventas general
app.get('/ventas', async (req, res) => {
    const ventas = await db.all('SELECT * FROM ventas ORDER BY fecha DESC');
    res.json(ventas);
});

// RUTA 7: Ver detalle de una venta específica
app.get('/ventas/:id', async (req, res) => {
    const { id } = req.params;
    const detalle = await db.all(`
        SELECT dv.*, p.nombre 
        FROM detalle_ventas dv
        JOIN productos p ON dv.producto_id = p.id
        WHERE dv.venta_id = ?
    `, [id]);
    res.json(detalle);
});

// RUTA DE EMERGENCIA: Borra todos los usuarios para empezar de cero
app.get('/reset-usuarios', async (req, res) => {
    try {
        await db.run('DELETE FROM usuarios');
        res.send({ mensaje: "Tabla de usuarios limpia. Ya puedes crear uno nuevo." });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});