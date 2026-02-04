import { useState, useEffect } from 'react'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// --- CONFIGURACIÓN ---
const API_URL = 'https://mi-pos-nova-backend.onrender.com'; 

function App() {
  // --- ESTADOS ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authData, setAuthData] = useState({ username: '', password: '', rol: 'cajero' });
  const [user, setUser] = useState({ nombre: '', rol: '' });
  const [productos, setProductos] = useState([]);
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', precio: '', stock: '' });
  const [carrito, setCarrito] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  // --- CARGA DE DATOS ---
  const obtenerProductos = async () => {
    try {
      const res = await axios.get(`${API_URL}/productos`);
      setProductos(res.data);
    } catch (e) { console.error("Error productos", e); }
  };

  const obtenerVentas = async () => {
    try {
      const res = await axios.get(`${API_URL}/ventas`);
      setVentas(res.data);
    } catch (e) { console.error("Error ventas", e); }
  };

  useEffect(() => {
    if (isLoggedIn) {
      obtenerProductos();
      obtenerVentas();
    }
  }, [isLoggedIn]);

  // --- LÓGICA DE NEGOCIO ---
  const productosFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  // --- MANEJADORES ---
  const manejarAuth = async (e) => {
    e.preventDefault();
    const endpoint = isRegistering ? '/register' : '/login';
    try {
      const res = await axios.post(`${API_URL}${endpoint}`, authData);
      if (isRegistering) {
        alert("¡Cuenta creada! Ya puedes iniciar sesión.");
        setIsRegistering(false);
        setAuthData({ username: '', password: '', rol: 'cajero' });
      } else {
        setUser({ nombre: res.data.username, rol: res.data.rol });
        setIsLoggedIn(true);
      }
    } catch (error) {
      alert(error.response?.data?.error || "Error en el acceso");
    }
  };

  const agregarAlCarrito = (producto) => {
    if (producto.stock <= 0) return alert("Sin stock disponible");
    const existe = carrito.find(item => item.id === producto.id);
    if (existe) {
      setCarrito(carrito.map(item => 
        item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
      ));
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    }
  };

  const finalizarVenta = async () => {
    try {
      const ventaData = { carrito: carrito.map(item => ({ id: item.id, cantidad: item.cantidad })) };
      await axios.post(`${API_URL}/ventas`, ventaData);
      imprimirTicket();
      alert("Venta procesada con éxito");
      setCarrito([]);
      obtenerProductos();
      obtenerVentas();
    } catch (error) {
      alert("Error: " + (error.response?.data?.error || "Error en el servidor"));
    }
  };

  const imprimirTicket = () => {
    const ventana = window.open('', '', 'width=400,height=600');
    ventana.document.write(`
      <html>
        <body style="font-family:monospace; padding:20px; text-align:center;">
          <h2>🚀 POS NOVA</h2>
          <p>Fecha: ${new Date().toLocaleString()}</p>
          <hr>
          ${carrito.map(i => `<div style="display:flex;justify-content:space-between"><span>${i.nombre} x${i.cantidad}</span><span>$${(i.precio*i.cantidad).toFixed(2)}</span></div>`).join('')}
          <hr>
          <h3>TOTAL: $${total.toFixed(2)}</h3>
          <p>¡Gracias por su compra!</p>
        </body>
      </html>
    `);
    ventana.document.close();
    setTimeout(() => { ventana.print(); ventana.close(); }, 500);
  };

  // --- VISTA DE LOGIN/REGISTRO ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-200">
          <h1 className="text-3xl font-black text-blue-600 text-center mb-2">POS NOVA</h1>
          <p className="text-center text-gray-500 mb-8 font-medium">{isRegistering ? 'Crea tu cuenta' : 'Ingresa al sistema'}</p>
          
          <form onSubmit={manejarAuth} className="space-y-4">
            <input 
              type="text" placeholder="Usuario" required 
              className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              value={authData.username}
              onChange={(e) => setAuthData({...authData, username: e.target.value})} 
            />
            <input 
              type="password" placeholder="Contraseña" required 
              className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              value={authData.password}
              onChange={(e) => setAuthData({...authData, password: e.target.value})} 
            />
            {isRegistering && (
              <select 
                className="w-full p-3 bg-gray-50 border rounded-xl outline-none"
                value={authData.rol}
                onChange={(e) => setAuthData({...authData, rol: e.target.value})}
              >
                <option value="cajero">Cajero</option>
                <option value="admin">Administrador</option>
              </select>
            )}
            <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all">
              {isRegistering ? 'REGISTRAR' : 'ENTRAR'}
            </button>
          </form>

          <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-6 text-sm text-gray-400 hover:text-blue-600">
            {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
          </button>
        </div>
      </div>
    );
  }

  // --- VISTA PRINCIPAL (DASHBOARD) ---
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-black text-blue-600">POS NOVA</h1>
          <p className="text-xs text-gray-400 font-bold uppercase">{user.rol}: {user.nombre}</p>
        </div>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100">SALIR</button>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">📦 Inventario</h2>
              <input 
                type="text" placeholder="Buscar producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                className="p-2 bg-gray-50 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 w-1/2"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody className="divide-y divide-gray-50">
                  {productosFiltrados.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="py-4 font-bold text-gray-700">{p.nombre}</td>
                      <td className="py-4 text-gray-500">${p.precio.toFixed(2)}</td>
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${p.stock < 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                          STOCK: {p.stock}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <button onClick={() => agregarAlCarrito(p)} className="bg-blue-600 text-white w-10 h-10 rounded-xl shadow-lg hover:scale-110 transition-all">+</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {user.rol === 'admin' && (
  <section className="bg-white p-6 rounded-2xl border-2 border-dashed border-gray-200">
    <h3 className="font-bold mb-4 text-gray-700">📦 Agregar Nuevo Producto al Inventario</h3>
    <form onSubmit={async (e) => {
      e.preventDefault();
      if(!nuevoProducto.nombre || !nuevoProducto.precio || !nuevoProducto.stock) {
        return alert("Por favor rellena todos los campos, incluyendo el stock");
      }
      await axios.post(`${API_URL}/productos`, nuevoProducto);
      setNuevoProducto({nombre:'', precio:'', stock:''});
      obtenerProductos();
    }} className="grid grid-cols-1 md:grid-cols-4 gap-3">
      
      <input type="text" placeholder="Nombre del producto" 
        className="p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
        value={nuevoProducto.nombre} 
        onChange={e => setNuevoProducto({...nuevoProducto, nombre: e.target.value})} />
      
      <input type="number" placeholder="Precio ($)" 
        className="p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
        value={nuevoProducto.precio} 
        onChange={e => setNuevoProducto({...nuevoProducto, precio: e.target.value})} />
      
      <input type="number" placeholder="Stock Inicial" 
        className="p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
        value={nuevoProducto.stock} 
        onChange={e => setNuevoProducto({...nuevoProducto, stock: e.target.value})} />
      
      <button type="submit" className="bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all">
        + AGREGAR
      </button>
      
    </form>
  </section>
)}
        </div>

        <div className="lg:col-span-5">
          <section className="bg-white p-6 rounded-3xl shadow-2xl border border-gray-100 sticky top-8">
            <h2 className="text-xl font-bold mb-6">🛒 Venta Actual</h2>
            <div className="space-y-3 mb-6 max-h-80 overflow-y-auto">
              {carrito.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-2xl">
                  <span className="font-bold text-sm">{item.nombre} x{item.cantidad}</span>
                  <span className="font-black text-blue-600">${(item.precio * item.cantidad).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-6">
              <div className="flex justify-between items-end mb-6">
                <span className="text-gray-400 font-bold">TOTAL</span>
                <span className="text-4xl font-black text-gray-900">${total.toFixed(2)}</span>
              </div>
              <button 
                onClick={finalizarVenta} disabled={carrito.length === 0}
                className="w-full py-4 bg-green-500 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-green-600 disabled:bg-gray-200 transition-all"
              >
                PAGAR Y TICKET
              </button>
            </div>
          </section>
        </div>
      </main>

      {user.rol === 'admin' && (
        <section className="max-w-6xl mx-auto mt-12 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-8">📈 Ventas Recientes</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ventas.slice(-10)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="id" tickFormatter={(v) => `#${v}`} />
                <YAxis />
                <Tooltip contentStyle={{borderRadius:'15px', border:'none', boxShadow:'0 10px 20px rgba(0,0,0,0.05)'}} />
                <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                  {ventas.map((_, i) => <Cell key={i} fill={i % 2 === 0 ? '#3b82f6' : '#93c5fd'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}

export default App;