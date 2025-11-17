import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, onSnapshot, updateDoc, deleteDoc, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';

// Variáveis de configuração (necessárias para o ambiente Canvas)
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
// A LINHA DE CORREÇÃO: Sanitiza appId para remover caminhos de arquivo que quebram a contagem de segmentos do Firestore.
const appId = rawAppId.split('/')[0]; 
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- UTILS ---

/**
 * Formata um número de WhatsApp (simplesmente remove não-dígitos)
 * @param {string} num 
 * @returns {string}
 */
const formatWhatsapp = (num) => num.replace(/\D/g, '');

/**
 * Retorna o caminho da COLEÇÃO de perfis do usuário (privado).
 * O documento individual dentro desta coleção terá o ID 'data'.
 * @param {string} userId 
 * @returns {string}
 */
const getUserProfileCollectionPath = (userId) => `artifacts/${appId}/users/${userId}/profiles`;

/**
 * Retorna o caminho da coleção de agendamentos (público)
 * @returns {string}
 */
const getAppointmentsCollectionPath = () => `artifacts/${appId}/public/data/appointments`;

// --- COMPONENTES ---

const LoadingScreen = ({ message }) => (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <div className="text-center">
            <svg className="animate-spin h-8 w-8 text-indigo-400 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-lg font-medium">{message}</p>
        </div>
    </div>
);

const NotificationDisplay = ({ appointment, onClose }) => {
    if (!appointment) return null;

    const appointmentDate = new Date(appointment.date + 'T' + appointment.time + ':00');
    const formattedDate = appointmentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    const formattedTime = appointmentDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Lógica SIMULADA do WhatsApp
    const whatsappMessage = `*🤖 Lembrete de Agendamento - Barbearia* Olá, ${appointment.userName}!
Seu agendamento para o corte está confirmado para:
🗓️ *Data:* ${formattedDate}
⏰ *Hora:* ${formattedTime}
📍 Estamos te esperando!`;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 p-6 rounded-xl shadow-2xl max-w-lg w-full transform transition-all border border-indigo-500">
                <h3 className="text-2xl font-bold mb-4 text-indigo-400">🔔 Lembrete de Agendamento</h3>
                <p className="text-gray-300 mb-6">
                    Seu agendamento foi salvo. O sistema enviaria este lembrete automaticamente no dia:
                </p>

                <div className="bg-green-800 p-4 rounded-lg shadow-md mb-6 border border-green-600">
                    <h4 className="font-semibold text-lg text-white mb-2 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-green-300" viewBox="0 0 0 0" fill="currentColor">
                            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 4v-4H4a2 2 0 01-2-2V5z" />
                        </svg>
                        Mensagem WhatsApp (Simulada)
                    </h4>
                    <pre className="text-sm whitespace-pre-wrap text-green-100 bg-green-900 p-3 rounded">{whatsappMessage}</pre>
                    <p className="mt-2 text-xs text-green-200 italic">
                        Para o envio real, seria necessário integrar uma API de WhatsApp (como Twilio ou Z-APIs).
                    </p>
                </div>

                <button
                    onClick={onClose}
                    className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-500 transition duration-200 shadow-lg shadow-indigo-500/50"
                >
                    Entendi! Ir para o Painel
                </button>
            </div>
        </div>
    );
};

const AuthScreen = ({ db, userId, onProfileComplete }) => {
    const [name, setName] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const formattedWhatsapp = formatWhatsapp(whatsapp);

        // 1. Validação de Nome: Requer pelo menos nome e sobrenome (2 palavras)
        if (!name || name.trim().split(/\s+/).length < 2) {
            setError('Por favor, preencha o nome completo (nome e sobrenome).');
            setIsLoading(false);
            return;
        }

        // 2. Validação de WhatsApp: Requer exatamente 11 dígitos (DD + 9XXXXXXXX)
        if (formattedWhatsapp.length !== 11) {
            setError('O número de WhatsApp deve ter 11 dígitos (DD + 9XXXX-XXXX).');
            setIsLoading(false);
            return;
        }

        try {
            const userProfileRef = doc(db, getUserProfileCollectionPath(userId), 'data');
            await setDoc(userProfileRef, {
                name: name.trim(),
                whatsapp: formattedWhatsapp,
                profileComplete: true,
                createdAt: serverTimestamp(),
            }, { merge: true });

            onProfileComplete({ name: name.trim(), whatsapp: formattedWhatsapp, profileComplete: true });

        } catch (err) {
            console.error('Erro ao salvar perfil:', err);
            setError('Falha ao salvar o perfil. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
            <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-indigo-700">
                {/* Título sem "SaaS" */}
                <h2 className="text-3xl font-extrabold text-white mb-4 text-center">💈 Bem-vindo(a) à Barbearia</h2>
                <p className="text-gray-400 mb-6 text-center">Complete seu cadastro para agendar seu corte.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-300">Nome Completo</label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Seu nome e sobrenome"
                            className="mt-1 block w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="whatsapp" className="block text-sm font-medium text-gray-300">WhatsApp (com DDD)</label>
                        <input
                            id="whatsapp"
                            type="tel"
                            value={whatsapp}
                            onChange={(e) => setWhatsapp(e.target.value)}
                            placeholder="Ex: 5511987654321 (11 dígitos)"
                            className="mt-1 block w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-indigo-500 focus:border-indigo-500 transition duration-150"
                            required
                        />
                    </div>

                    {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Salvando...
                            </>
                        ) : 'Salvar e Continuar'}
                    </button>
                </form>
            </div>
            <p className="text-xs text-gray-500 mt-4">ID do Usuário: {userId}</p>
        </div>
    );
};

const ScheduleGrid = ({ db, userId, userProfile, setCurrentPage, onBookingConfirmed }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedTime, setSelectedTime] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [isBooking, setIsBooking] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Listener de Agendamentos em tempo real
        const appointmentsRef = collection(db, getAppointmentsCollectionPath());
        // Não usamos orderBy para evitar a necessidade de índice, e filtramos/ordenamos no cliente
        const q = query(appointmentsRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedAppointments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAppointments(fetchedAppointments);
        }, (err) => {
            console.error("Erro ao carregar agendamentos:", err);
            // Em produção, isso seria um erro de segurança/rede
        });

        return () => unsubscribe();
    }, [db]);

    const isToday = (date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    const getAvailableSlots = useCallback((date) => {
        const timeSlots = [];
        // Horários de funcionamento: 9:00h às 18:00h, agendamentos a cada 60 minutos
        for (let hour = 9; hour <= 17; hour++) {
            // 18:00h não é um slot, pois o serviço leva 60 minutos
            if (hour < 18) {
                timeSlots.push(`${hour < 10 ? '0' : ''}${hour}:00`);
            }
        }

        const dateString = date.toISOString().split('T')[0];
        const now = new Date();

        return timeSlots.filter(time => {
            const isBooked = appointments.some(app => app.date === dateString && app.time === time);
            if (isBooked) return false;

            // Bloquear horários passados ou o slot atual se for hoje
            if (isToday(date)) {
                const [h, m] = time.split(':').map(Number);
                const slotTime = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
                // O slot deve ser pelo menos 1 hora no futuro
                return slotTime.getTime() > now.getTime() + 60 * 60 * 1000;
            }

            return true;
        });
    }, [appointments]);

    const availableSlots = useMemo(() => getAvailableSlots(selectedDate), [selectedDate, getAvailableSlots]);

    const handleDateChange = (days) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(selectedDate.getDate() + days);
        if (newDate.getTime() < new Date().setHours(0, 0, 0, 0)) return; // Não permitir voltar para o passado

        setSelectedDate(newDate);
        setSelectedTime(null);
        setError('');
    };

    const handleSelectTime = (time) => {
        setSelectedTime(time);
        setError('');
    };

    const handlePaymentAndBooking = async () => {
        if (!selectedTime) {
            setError('Por favor, selecione um horário.');
            return;
        }

        // SIMULAÇÃO DE PAGAMENTO:
        // Valor de R$ 10,00
        if (!window.confirm(`Simulação de Pagamento: O valor de R$ 10,00 será cobrado. Pressione OK para simular o pagamento e confirmar o agendamento.`)) {
            setError('Pagamento cancelado ou falhou. O agendamento não foi concluído.');
            return;
        }
        
        // Pagamento SIMULADO bem-sucedido!
        
        setIsBooking(true);
        setError('');

        const newAppointment = {
            userId: userId,
            userName: userProfile.name,
            whatsapp: userProfile.whatsapp,
            date: selectedDate.toISOString().split('T')[0],
            time: selectedTime,
            service: 'Corte Clássico',
            price: 10.00,
            paid: true,
            createdAt: serverTimestamp(),
        };

        try {
            const appointmentsRef = collection(db, getAppointmentsCollectionPath());
            const docRef = await addDoc(appointmentsRef, newAppointment);
            
            // Sucesso! Chamar a notificação e limpar o estado.
            onBookingConfirmed({ ...newAppointment, id: docRef.id });

        } catch (err) {
            console.error('Erro ao salvar agendamento:', err);
            setError('Falha ao registrar o agendamento no sistema. Tente novamente.');
        } finally {
            setIsBooking(false);
        }
    };

    const formattedDate = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    return (
        <div className="p-6 bg-gray-900 min-h-screen">
            <h2 className="text-3xl font-extrabold text-white mb-6 border-b border-indigo-700 pb-2">🗓️ Agendar Horário</h2>
            <div className="max-w-4xl mx-auto">
                {/* Seletor de Data */}
                <div className="flex items-center justify-between bg-gray-800 p-4 rounded-xl shadow-lg mb-6">
                    <button
                        onClick={() => handleDateChange(-1)}
                        disabled={selectedDate.getTime() <= new Date().setHours(0, 0, 0, 0)}
                        className="p-2 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition duration-150"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h3 className="text-xl font-semibold text-white text-center flex-grow">{formattedDate}</h3>
                    <button
                        onClick={() => handleDateChange(1)}
                        className="p-2 rounded-full bg-indigo-600 hover:bg-indigo-500 transition duration-150"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>

                {/* Grid de Horários */}
                <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                    <h4 className="text-xl font-bold text-indigo-400 mb-4">Horários Disponíveis (Corte - 60 min)</h4>
                    {availableSlots.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">Nenhum horário disponível para esta data. Tente outro dia.</p>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {availableSlots.map(time => (
                                <button
                                    key={time}
                                    onClick={() => handleSelectTime(time)}
                                    className={`py-3 px-2 rounded-lg text-sm font-medium transition duration-200 
                                        ${selectedTime === time 
                                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50 transform scale-105' 
                                            : 'bg-gray-700 text-gray-300 hover:bg-indigo-600 hover:text-white'
                                        }`}
                                >
                                    {time}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Confirmação e Pagamento */}
                {selectedTime && (
                    <div className="mt-6 p-6 bg-indigo-900 bg-opacity-30 border border-indigo-600 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-center">
                        <div className="text-white mb-4 sm:mb-0">
                            <p className="text-lg font-semibold">Agendamento Selecionado:</p>
                            <p className="text-2xl font-bold">{selectedTime} - {formattedDate}</p>
                            {/* Valor R$ 10,00 */}
                            <p className="text-indigo-300 text-sm mt-1">Valor do Agendamento: R$ 10,00</p>
                        </div>
                        <button
                            onClick={handlePaymentAndBooking}
                            disabled={isBooking}
                            className="w-full sm:w-auto flex items-center justify-center py-3 px-6 rounded-lg text-lg font-bold text-white bg-green-600 hover:bg-green-700 transition duration-200 shadow-xl shadow-green-600/40 disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isBooking ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processando...
                                </>
                            ) : 'Confirmar e Pagar (Simulado)'}
                        </button>
                    </div>
                )}
                {error && <p className="text-red-400 text-center mt-4">{error}</p>}
                
                <button
                    onClick={() => setCurrentPage('dashboard')}
                    className="mt-6 w-full py-2 text-indigo-400 hover:text-indigo-300 transition duration-150"
                >
                    Voltar para o Painel
                </button>
            </div>
        </div>
    );
};


const DashboardScreen = ({ userId, userProfile, appointments, setCurrentPage }) => {
    const upcomingAppointments = useMemo(() => {
        const now = new Date();
        return appointments
            .filter(app => app.userId === userId) // Filtrar apenas os agendamentos do usuário logado
            .map(app => {
                const dateTime = new Date(app.date + 'T' + app.time + ':00');
                return {
                    ...app,
                    dateTime,
                };
            })
            .filter(app => app.dateTime.getTime() >= now.getTime()) // Apenas agendamentos futuros
            .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()); // Ordenar por mais próximo
    }, [appointments, userId]);

    const formattedWhatsapp = userProfile.whatsapp ? `+${userProfile.whatsapp.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '$1 ($2) $3-$4')}` : 'Não informado';

    return (
        <div className="p-6 bg-gray-900 min-h-screen text-white">
            <header className="flex justify-between items-center mb-6 pb-4 border-b border-indigo-700">
                <h1 className="text-3xl font-bold text-indigo-400">👋 Olá, {userProfile.name.split(' ')[0]}!</h1>
                <button
                    onClick={() => setCurrentPage('schedule')}
                    className="flex items-center bg-indigo-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-indigo-500 transition duration-200 shadow-md shadow-indigo-500/50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    Novo Agendamento
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cartão de Perfil */}
                <div className="lg:col-span-1 bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700 h-fit">
                    <h3 className="text-xl font-bold text-indigo-400 mb-4">👤 Meu Perfil</h3>
                    <p className="text-gray-300">
                        <span className="font-semibold block">Nome:</span> {userProfile.name}
                    </p>
                    <p className="text-gray-300 mt-2">
                        <span className="font-semibold block">WhatsApp:</span> {formattedWhatsapp}
                    </p>
                    <p className="text-xs text-gray-500 mt-4">Este é o número que receberá o lembrete.</p>
                </div>

                {/* Cartão de Agendamentos */}
                <div className="lg:col-span-2 bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700">
                    <h3 className="text-xl font-bold text-indigo-400 mb-4">🗓️ Próximos Cortes ({upcomingAppointments.length})</h3>
                    
                    {upcomingAppointments.length === 0 ? (
                        <div className="text-center py-10 bg-gray-700 rounded-lg">
                            <p className="text-gray-400 text-lg">Você não tem agendamentos futuros.</p>
                            <button
                                onClick={() => setCurrentPage('schedule')}
                                className="mt-4 text-indigo-400 hover:text-indigo-300 font-medium"
                            >
                                Clique aqui para agendar!
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {upcomingAppointments.map((app, index) => (
                                <div key={app.id} className="p-4 rounded-lg bg-gray-700 border-l-4 border-indigo-500 flex justify-between items-center transition duration-150 hover:bg-gray-600">
                                    <div>
                                        <p className="text-lg font-bold text-white">
                                            {app.dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <p className="text-sm text-gray-300">
                                            {app.dateTime.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        </p>
                                        <p className="text-xs text-indigo-300 mt-1">{app.service} (R$ {app.price.toFixed(2).replace('.', ',')})</p>
                                    </div>
                                    <span className="text-xs font-semibold px-3 py-1 bg-green-600 rounded-full text-white">
                                        {app.paid ? 'Pago' : 'Pendente'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- APP PRINCIPAL ---

const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // Estado da Aplicação
    const [currentPage, setCurrentPage] = useState('dashboard'); // 'auth', 'dashboard', 'schedule'
    const [userProfile, setUserProfile] = useState(null); // { name, whatsapp, profileComplete }
    const [appointments, setAppointments] = useState([]); // Lista de todos os agendamentos
    const [showNotification, setShowNotification] = useState(null); // Guarda o objeto do agendamento recém-criado

    // 1. Inicialização do Firebase e Autenticação
    useEffect(() => {
        if (!firebaseConfig) {
            console.error("Configuração do Firebase não encontrada.");
            return;
        }

        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const firebaseAuth = getAuth(app);
        
        setDb(firestore);
        setAuth(firebaseAuth);

        // Listener de estado de autenticação
        const unsubscribeAuth = onAuthStateChanged(firebaseAuth, (user) => {
            if (user) {
                setUserId(user.uid);
                // Tenta carregar o perfil assim que o usuário estiver autenticado
                loadUserProfile(firestore, user.uid);
            } else {
                // Se não houver usuário, tenta login com o token inicial ou anônimo
                authenticateUser(firebaseAuth, firestore);
            }
        });

        const authenticateUser = async (authInstance, dbInstance) => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(authInstance, initialAuthToken);
                } else {
                    await signInAnonymously(authInstance);
                }
            } catch (error) {
                console.error("Erro na autenticação:", error);
            }
        };

        const loadUserProfile = async (dbInstance, uid) => {
            try {
                // Obtém a referência do documento de perfil
                const docRef = doc(dbInstance, getUserProfileCollectionPath(uid), 'data');
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists() && docSnap.data().profileComplete) {
                    setUserProfile(docSnap.data());
                } else {
                    // Se o perfil não estiver completo, leva para a tela de Auth
                    setCurrentPage('auth');
                }
                setIsAuthReady(true);
            } catch (error) {
                console.error("Erro ao carregar perfil:", error);
                setIsAuthReady(true); // Permite a renderização mesmo com erro
            }
        };

        return () => unsubscribeAuth();
    }, []);


    // 2. Listener de Agendamentos (só roda após a autenticação)
    useEffect(() => {
        if (!db || !isAuthReady || !userProfile) return; // Espera o DB e o Perfil

        // Listener de Agendamentos em tempo real para o Dashboard
        const appointmentsRef = collection(db, getAppointmentsCollectionPath());
        const q = query(appointmentsRef); // Sem filtro, o ScheduleGrid irá filtrar

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedAppointments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAppointments(fetchedAppointments);
        }, (err) => {
            console.error("Erro ao carregar agendamentos:", err);
        });

        return () => unsubscribe();
    }, [db, isAuthReady, userProfile]);
    
    // Função de callback para atualização de perfil
    const handleProfileComplete = (profileData) => {
        setUserProfile(profileData);
        setCurrentPage('dashboard');
    };

    // Função de callback para agendamento confirmado
    const handleBookingConfirmed = (newAppointment) => {
        setShowNotification(newAppointment);
        setCurrentPage('dashboard');
    }

    // Lógica de Renderização
    let content;

    if (!isAuthReady) {
        content = <LoadingScreen message="Inicializando sistema..." />;
    } else if (!userProfile || !userProfile.profileComplete) {
        content = <AuthScreen db={db} userId={userId} onProfileComplete={handleProfileComplete} />;
    } else {
        switch (currentPage) {
            case 'schedule':
                content = (
                    <ScheduleGrid
                        db={db}
                        userId={userId}
                        userProfile={userProfile}
                        setCurrentPage={setCurrentPage}
                        onBookingConfirmed={handleBookingConfirmed}
                    />
                );
                break;
            case 'dashboard':
            default:
                content = (
                    <DashboardScreen
                        userId={userId}
                        userProfile={userProfile}
                        appointments={appointments}
                        setCurrentPage={setCurrentPage}
                    />
                );
                break;
        }
    }

    return (
        <div className="min-h-screen bg-gray-900 font-sans">
            {content}
            {showNotification && (
                <NotificationDisplay 
                    appointment={showNotification} 
                    onClose={() => setShowNotification(null)} 
                />
            )}
        </div>
    );
};

export default App;