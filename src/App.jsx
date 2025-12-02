import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { format, parse, isValid, isWeekend, differenceInMinutes } from 'date-fns';
import { LogIn, Clock, Search, LogOut } from 'lucide-react';

// --- CONFIGURACIÓN ---
const CREDENCIALES = {
  "luisln": "Luisln2227",
  "gerencia": "gerencia2025",
  "rrhh": "rrhh123"
};

const HORA_ENTRADA_LIMITE = "08:00"; // HH:mm

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Datos
  const [usersData, setUsersData] = useState([]);
  const [logsData, setLogsData] = useState([]);
  const [holidays, setHolidays] = useState(new Set());
  
  // Filtros
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedArea, setSelectedArea] = useState("TODOS");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyLate, setShowOnlyLate] = useState(false);

  // Login Persistente
  useEffect(() => {
    const sessionUser = localStorage.getItem('biometric_user');
    if (sessionUser) setUser(sessionUser);
  }, []);

  // Cargar Datos al iniciar sesión
  useEffect(() => {
    if (user) loadAllData();
  }, [user]);

  const handleLogin = (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;

    if (CREDENCIALES[username] === password) {
      setUser(username);
      localStorage.setItem('biometric_user', username);
      setError("");
    } else {
      setError("❌ Usuario o contraseña incorrectos");
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('biometric_user');
    setUsersData([]);
    setLogsData([]);
  };

  // --- LÓGICA DE CARGA DE DATOS ---
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [usersRes, logsRes, holidaysRes] = await Promise.all([
        fetch('/usuarios.csv').then(r => r.text()),
        fetch('/registros.csv').then(r => r.text()),
        fetch('/feriados.csv').then(r => r.text())
      ]);

      processUsers(usersRes);
      processLogs(logsRes);
      processHolidays(holidaysRes);
    } catch (err) {
      setError("Error cargando archivos CSV. Asegúrate de que estén en la carpeta public.");
    }
    setLoading(false);
  };

  const processUsers = (csvText) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const normalized = results.data.map(row => {
          const newRow = {};
          Object.keys(row).forEach(key => {
            const cleanKey = key.toLowerCase().trim();
            if (cleanKey.includes('nombre') || cleanKey.includes('name')) newRow.Nombre = row[key];
            if (cleanKey.includes('id') || cleanKey.includes('codigo')) newRow.ID = row[key];
            if (cleanKey.includes('area') || cleanKey.includes('depto')) newRow.Area = row[key];
          });
          if (!newRow.Area) newRow.Area = 'GENERAL';
          return newRow;
        }).filter(u => u.ID && u.Nombre);
        setUsersData(normalized);
      }
    });
  };

  const processHolidays = (csvText) => {
    Papa.parse(csvText, {
      header: false,
      complete: (results) => {
        const holidaySet = new Set();
        results.data.forEach(row => {
          if (row[0]) {
            const date = tryParseDate(row[0]);
            if (date) holidaySet.add(format(date, 'yyyy-MM-dd'));
          }
        });
        setHolidays(holidaySet);
      }
    });
  };

  const processLogs = (csvText) => {
    const lines = csvText.split('\n');
    const validLogs = [];
    const dateRegex = /(\d{4}[-/]\d{2}[-/]\d{2})|(\d{2}[-/]\d{2}[-/]\d{4})/;
    const timeRegex = /(\d{1,2}:\d{2}:\d{2})/;
    const idRegex = /\b\d{1,10}\b/;

    lines.forEach(line => {
      const dateMatch = line.match(dateRegex);
      const timeMatch = line.match(timeRegex);

      if (dateMatch && timeMatch) {
        const dateStr = dateMatch[0];
        const timeStr = timeMatch[0];
        const cleanLine = line.replace(dateStr, '').replace(timeStr, '');
        const idMatch = cleanLine.match(idRegex);

        if (idMatch) {
          const dateObj = tryParseDate(dateStr);
          if (dateObj) {
            validLogs.push({
              ID: idMatch[0],
              Fecha: format(dateObj, 'yyyy-MM-dd'),
              Hora: timeStr,
              Mes: format(dateObj, 'yyyy-MM')
            });
          }
        }
      }
    });
    
    setLogsData(validLogs);
    if (validLogs.length > 0) {
      const months = [...new Set(validLogs.map(l => l.Mes))].sort().reverse();
      setSelectedMonth(months[0]);
    }
  };

  const tryParseDate = (dateStr) => {
    const formats = ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy/MM/dd'];
    for (let fmt of formats) {
      const parsed = parse(dateStr, fmt, new Date());
      if (isValid(parsed)) return parsed;
    }
    return null;
  };

  // --- CALCULOS Y RENDERIZADO ---
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="flex justify-center mb-4 text-blue-600"><LogIn size={48} /></div>
          <h2 className="text-2xl font-bold text-center mb-6">Acceso Biométrico</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input name="username" placeholder="Usuario" className="w-full p-2 border rounded" required />
            <input name="password" type="password" placeholder="Contraseña" className="w-full p-2 border rounded" required />
            <button className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Ingresar</button>
          </form>
          {error && <p className="text-red-500 text-center mt-4">{error}</p>}
        </div>
      </div>
    );
  }

  const availableMonths = [...new Set(logsData.map(l => l.Mes))].sort().reverse();
  const availableAreas = ["TODOS", ...new Set(usersData.map(u => u.Area))].sort();
  const currentLogs = logsData.filter(l => l.Mes === selectedMonth);
  
  const logsByKey = {}; 
  currentLogs.forEach(log => {
    const key = `${log.ID}_${log.Fecha}`;
    if (!logsByKey[key] || log.Hora < logsByKey[key]) {
      logsByKey[key] = log.Hora;
    }
  });

  const getWorkdays = (monthStr) => {
    if (!monthStr) return [];
    const [year, month] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const workdays = [];
    
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d);
      const dateStr = format(date, 'yyyy-MM-dd');
      if (!isWeekend(date) && !holidays.has(dateStr)) {
        workdays.push(dateStr);
      }
    }
    return workdays;
  };

  const workdays = getWorkdays(selectedMonth);
  const today = format(new Date(), 'yyyy-MM-dd');
  let reportData = [];
  let detailData = [];
  const limitTimeObj = parse(HORA_ENTRADA_LIMITE, 'HH:mm', new Date());

  usersData.forEach(u => {
    if (selectedArea !== "TODOS" && u.Area !== selectedArea) return;
    if (searchQuery && !u.Nombre.toLowerCase().includes(searchQuery.toLowerCase())) return;

    let delays = 0;
    let delayMinutes = 0;
    let absences = 0;
    const attendedDates = new Set();

    Object.keys(logsByKey).forEach(key => {
      if (key.startsWith(u.ID)) {
        const date = key.split('_')[1];
        const timeStr = logsByKey[key];
        attendedDates.add(date);

        const logTimeObj = parse(timeStr, 'HH:mm:ss', new Date());
        const limitBase = new Date(logTimeObj);
        limitBase.setHours(limitTimeObj.getHours(), limitTimeObj.getMinutes(), 0);
        const diff = differenceInMinutes(logTimeObj, limitBase);
        const isLate = diff > 0;
        
        if (isLate) {
          delays++;
          delayMinutes += diff;
        }

        let status = isLate ? "RETRASO" : "PUNTUAL";
        if (holidays.has(date)) status += " (FERIADO)";

        detailData.push({
          Fecha: date, Empleado: u.Nombre, Area: u.Area, Hora: timeStr, 
          Retraso: isLate ? diff : 0, Estado: status
        });
      }
    });

    workdays.forEach(day => {
      if (day <= today && !attendedDates.has(day)) {
        absences++;
        detailData.push({
          Fecha: day, Empleado: u.Nombre, Area: u.Area, Hora: "-", 
          Retraso: 0, Estado: "AUSENTE"
        });
      }
    });

    if (showOnlyLate && delays === 0) return;

    reportData.push({
      ID: u.ID, Nombre: u.Nombre, Area: u.Area, 
      Retrasos: delays, Minutos: delayMinutes, Faltas: absences
    });
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="bg-white shadow rounded-lg p-4 mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Clock className="text-blue-600" />
          <h1 className="text-xl font-bold text-gray-800">Control Biométrico</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden sm:block">Usuario: <b>{user}</b></span>
          <button onClick={logout} className="text-red-500 hover:bg-red-50 p-2 rounded"><LogOut size={20}/></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <select className="p-2 border rounded bg-white" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
          {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        
        <select className="p-2 border rounded bg-white" value={selectedArea} onChange={e => setSelectedArea(e.target.value)}>
          {availableAreas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18}/>
          <input 
            type="text" 
            placeholder="Buscar empleado..." 
            className="w-full pl-10 p-2 border rounded"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center">
          <input 
            type="checkbox" 
            id="late" 
            className="mr-2 h-5 w-5"
            checked={showOnlyLate}
            onChange={e => setShowOnlyLate(e.target.checked)}
          />
          <label htmlFor="late" className="text-sm">Solo con retrasos</label>
        </div>
      </div>

      {loading && <div className="text-center py-10">Cargando datos...</div>}

      {!loading && reportData.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded shadow border-l-4 border-yellow-500">
              <p className="text-gray-500">Total Retrasos</p>
              <p className="text-2xl font-bold">{reportData.reduce((a, b) => a + b.Retrasos, 0)}</p>
            </div>
            <div className="bg-white p-4 rounded shadow border-l-4 border-red-500">
              <p className="text-gray-500">Minutos Perdidos</p>
              <p className="text-2xl font-bold">{reportData.reduce((a, b) => a + b.Minutos, 0)} min</p>
            </div>
            <div className="bg-white p-4 rounded shadow border-l-4 border-gray-500">
              <p className="text-gray-500">Faltas Totales</p>
              <p className="text-2xl font-bold">{reportData.reduce((a, b) => a + b.Faltas, 0)}</p>
            </div>
          </div>

          <div className="bg-white rounded shadow overflow-x-auto mb-8">
            <div className="p-4 border-b font-bold bg-gray-50">Resumen General</div>
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3 text-center">Retrasos</th>
                  <th className="px-4 py-3 text-center">Minutos</th>
                  <th className="px-4 py-3 text-center">Faltas</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((row, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{row.Nombre}</td>
                    <td className="px-4 py-3 text-gray-500">{row.Area}</td>
                    <td className={`px-4 py-3 text-center font-bold ${row.Retrasos > 0 ? 'text-red-600' : ''}`}>{row.Retrasos}</td>
                    <td className="px-4 py-3 text-center">{row.Minutos}</td>
                    <td className="px-4 py-3 text-center">{row.Faltas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded shadow overflow-x-auto">
            <div className="p-4 border-b font-bold bg-gray-50">Detalle Diario</div>
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Empleado</th>
                  <th className="px-4 py-3">Hora</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {detailData.sort((a,b) => b.Fecha.localeCompare(a.Fecha)).map((row, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{row.Fecha}</td>
                    <td className="px-4 py-3">{row.Empleado}</td>
                    <td className="px-4 py-3">{row.Hora}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold
                        ${row.Estado.includes('RETRASO') ? 'bg-red-100 text-red-800' : 
                          row.Estado.includes('PUNTUAL') ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {row.Estado} {row.Retraso > 0 ? `(${row.Retraso}m)` : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default App;