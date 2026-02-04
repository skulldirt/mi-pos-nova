import { useState, useEffect } from 'react'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function App() {
  // --- ESTADOS ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userCredentials, setUserCredentials] = useState({ username: '', password: '' });
  const [user, setUser] = useState({ nombre: '', rol: '' });
  const [productos, setProductos] = useState([]);
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', precio: '', stock: '' });
  const [carrito, setCarrito] = useState([]);
  const [ventas, setVentas] = useState([]);
  
  // 1. AGREGAMOS EL ESTADO DE BÚSQUEDA QUE FALTABA
  const [busqueda, setBusqueda] = useState('');

  // --- FUNCIONES DE CARGA ---
  const obtenerProductos = async () => {
    try {
      const res = await axios.get('https://mi-pos-nova-backend.onrender.com/productos');
      setProductos(res.data);
    } catch (e) { console.error("Error cargando productos", e); }
  };

  const obtenerVentas = async () => {
    try {
      const res = await axios.get('https://mi-pos-nova-backend.onrender.com/ventas');
      setVentas(res.data);
    } catch (e) { console.error("Error cargando ventas", e); }
  };

  useEffect(() => {
    if (isLoggedIn) {
      obtenerProductos();
      obtenerVentas();
    }
  }, [isLoggedIn]);

  // 2. AGREGAMOS LA LÓGICA DE FILTRADO QUE FALTABA
  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  // --- ACCIONES ---
  const manejarLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('https://mi-pos-nova-backend.onrender.com/login', userCredentials);
      setUser({ nombre: res.data.username, rol: res.data.rol });
      setIsLoggedIn(true);
    } catch (error) {
      alert("Usuario o clave incorrectos");
    }
  };

  const manejarEnvio = async (e) => {
    e.preventDefault();
    await axios.post('http://localhost:3000/productos', nuevoProducto);
    setNuevoProducto({ nombre: '', precio: '', stock: '' });
    obtenerProductos();
  };

  const agregarAlCarrito = (producto) => {
    const existe = carrito.find(item => item.id === producto.id);
    if (existe) {
      setCarrito(carrito.map(item => 
        item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
      ));
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    }
  };

  const imprimirTicket = (ventaFinalizada) => {
  const ventana = window.open('', '', 'width=400,height=600');
  ventana.document.write(`
    <html>
      <head>
        <title>Ticket de Venta</title>
        <style>
          body { font-family: monospace; padding: 20px; text-align: center; }
          .header { font-weight: bold; font-size: 18px; }
          .line { border-bottom: 1px dashed #000; margin: 10px 0; }
          .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .total { font-size: 20px; font-weight: bold; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">🚀 POS NOVA</div>
        <div>Ticket #${Math.floor(Math.random() * 1000)}</div>
        <div>Fecha: ${new Date().toLocaleString()}</div>
        <div class="line"></div>
        ${carrito.map(item => `
          <div class="item">
            <span>${item.nombre} x${item.cantidad}</span>
            <span>$${(item.precio * item.cantidad).toFixed(2)}</span>
          </div>
        `).join('')}
        <div class="line"></div>
        <div class="total">TOTAL: $${total.toFixed(2)}</div>
        <br>
        <div>¡Gracias por su compra!</div>
      </body>
    </html>
  `);
  ventana.document.close();
  ventana.print();
  ventana.close();
};

  const finalizarVenta = async () => {
    try {
      const ventaData = { carrito: carrito.map(item => ({ id: item.id, cantidad: item.cantidad })) };
      await axios.post('http://localhost:3000/ventas', ventaData);
      imprimirTicket();
      alert("¡Venta realizada con éxito!");
      setCarrito([]);
      obtenerProductos();
      obtenerVentas();
    } catch (error) {
      alert("Error en la venta: " + (error.response?.data?.error || "Desconocido"));
    }
  };

  const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  // --- RENDERIZADO CONDICIONAL ---

  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
        <form onSubmit={manejarLogin} style={{ background: 'white', padding: '40px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h2 style={{ textAlign: 'center' }}>🔒 Acceso al Sistema</h2>
          <input type="text" placeholder="Usuario" required 
            onChange={(e) => setUserCredentials({...userCredentials, username: e.target.value})}
            style={{ display: 'block', width: '100%', marginBottom: '15px', padding: '10px' }} />
          <input type="password" placeholder="Contraseña" required 
            onChange={(e) => setUserCredentials({...userCredentials, password: e.target.value})}
            style={{ display: 'block', width: '100%', marginBottom: '20px', padding: '10px' }} />
          <button type="submit" style={{ width: '100%', padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Ingresar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800">
      
      {/* HEADER / BARRA SUPERIOR */}
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
            <span>🚀</span> POS NOVA
          </h1>
          <p className="text-sm text-gray-500">Sesión iniciada como: <span className="font-semibold text-gray-700">{user.nombre}</span></p>
        </div>
        <button 
          onClick={() => setIsLoggedIn(false)} 
          className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium transition-colors border border-red-200"
        >
          Cerrar Sesión
        </button>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMNA IZQUIERDA: INVENTARIO */}
        <div className="lg:col-span-7 space-y-6">
          
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">📦 Inventario</h2>
            
            {/* BUSCADOR */}
            <div className="relative mb-6">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">🔍</span>
              <input 
                type="text" 
                placeholder="Buscar por nombre de producto..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            {/* TABLA */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-400 text-sm uppercase tracking-wider border-b border-gray-100">
                    <th className="pb-3 pl-2">Producto</th>
                    <th className="pb-3 text-center">Precio</th>
                    <th className="pb-3 text-center">Stock</th>
                    <th className="pb-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {productosFiltrados.map(p => (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="py-4 pl-2 font-medium">{p.nombre}</td>
                      <td className="py-4 text-center text-gray-600">${p.precio.toFixed(2)}</td>
                      <td className="py-4 text-center">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${p.stock < 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                          {p.stock}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <button 
                          onClick={() => agregarAlCarrito(p)}
                          className="bg-blue-600 hover:bg-blue-700 text-white w-8 h-8 rounded-full shadow-lg shadow-blue-200 transition-transform active:scale-90"
                        >
                          +
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* FORMULARIO AGREGAR (Solo Admin) */}
          {user.rol === 'admin' && (
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-blue-500">
              <h3 className="font-bold mb-4 text-gray-700">Añadir Nuevo Producto</h3>
              <form onSubmit={manejarEnvio} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input type="text" placeholder="Nombre" required className="p-2 bg-gray-50 border rounded-lg outline-none focus:border-blue-400" value={nuevoProducto.nombre} onChange={(e) => setNuevoProducto({...nuevoProducto, nombre: e.target.value})} />
                <input type="number" placeholder="Precio" required className="p-2 bg-gray-50 border rounded-lg outline-none focus:border-blue-400" value={nuevoProducto.precio} onChange={(e) => setNuevoProducto({...nuevoProducto, precio: e.target.value})} />
                <div className="flex gap-2">
                  <input type="number" placeholder="Stock" required className="w-full p-2 bg-gray-50 border rounded-lg outline-none focus:border-blue-400" value={nuevoProducto.stock} onChange={(e) => setNuevoProducto({...nuevoProducto, stock: e.target.value})} />
                  <button type="submit" className="bg-gray-800 text-white px-4 rounded-lg hover:bg-black transition-colors">Guardar</button>
                </div>
              </form>
            </section>
          )}
        </div>

        {/* COLUMNA DERECHA: CARRITO */}
        <div className="lg:col-span-5">
          <section className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 sticky top-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">🛒 Venta Actual</h2>
            
            <div className="space-y-4 min-h-75 max-h-125 overflow-y-auto pr-2 mb-6">
              {carrito.length === 0 ? (
                <div className="text-center py-20 text-gray-400 italic">El carrito está vacío</div>
              ) : (
                carrito.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <p className="font-bold text-gray-800">{item.nombre}</p>
                      <p className="text-xs text-gray-500">{item.cantidad} unidad(es) x ${item.precio}</p>
                    </div>
                    <p className="font-bold text-blue-600">${(item.precio * item.cantidad).toFixed(2)}</p>
                  </div>
                ))
              )}
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-500 font-medium">Total a cobrar:</span>
                <span className="text-3xl font-black text-gray-900">${total.toFixed(2)}</span>
              </div>
              <button 
                onClick={finalizarVenta}
                disabled={carrito.length === 0}
                className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all active:scale-95 ${carrito.length === 0 ? 'bg-gray-300' : 'bg-green-500 hover:bg-green-600 shadow-green-200'}`}
              >
                CONFIRMAR Y PAGAR
              </button>
            </div>
          </section>
        </div>

      </main>
        {/* HISTORIAL: GRAFICO */}
      {user.rol === 'admin' && (
  <section className="max-w-6xl mx-auto mt-12 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">📈 Rendimiento de Ventas</h2>
    
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={ventas.slice(-10)}> {/* Mostramos las últimas 10 ventas */}
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis 
            dataKey="id" 
            tick={{fontSize: 12}} 
            tickFormatter={(value) => `Ticket #${value}`} 
          />
          <YAxis tick={{fontSize: 12}} />
          <Tooltip 
            cursor={{fill: '#f8fafc'}}
            contentStyle={{borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {ventas.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#60a5fa'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </section>
)}

      {/* HISTORIAL (Solo Admin) */}
      {user.rol === 'admin' && (
        <section className="max-w-6xl mx-auto mt-12 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-6">📊 Historial Reciente</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ventas.slice(0, 6).map(v => (
              <div key={v.id} className="p-4 border border-gray-50 rounded-xl bg-gray-50/50">
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-bold text-gray-400 uppercase">Ticket #{v.id}</span>
                  <span className="text-xs text-gray-500">{new Date(v.fecha).toLocaleDateString()}</span>
                </div>
                <p className="text-xl font-bold text-green-600">${v.total.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

export default App;