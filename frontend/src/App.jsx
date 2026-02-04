import { useState, useEffect } from 'react'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// --- CONFIGURACIÓN ---
const API_URL = 'https://mi-pos-nova-backend.onrender.com'; // Cambia esto por tu URL real de Render

function App() {
  // --- ESTADOS ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false); // Alternar entre Login/Registro
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

  // --- MANEJADORES DE EVENTOS ---
  const manejarAuth = async (e) => {
    e.preventDefault();
    const endpoint = isRegistering ? '/register' : '/login';
    try {
      const res = await axios.post(`${API_URL}${endpoint}`, authData);
      if (isRegistering) {
        alert("Cuenta creada con éxito. Ya puedes iniciar sesión.");
        setIsRegistering(false);
      } else {
        setUser({ nombre: res.data.username, rol: res.data.rol });
        setIsLoggedIn(true);
      }
    } catch (error) {
      alert(error.response?.data?.error || "Error en la autenticación");
    }
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

  const finalizarVenta = async () => {
    try {
      const ventaData = { carrito: carrito.map(item => ({ id: item.id, cantidad: item.cantidad })) };
      await axios.post(`${API_URL}/ventas`, ventaData);
      imprimirTicket();
      alert("¡Venta realizada!");
      setCarrito([]);
      obtenerProductos();
      obtenerVentas();
    } catch (error) {
      alert("Error: " + (error.response?.data?.error || "Desconocido"));
    }
  };

  const imprimirTicket = ()