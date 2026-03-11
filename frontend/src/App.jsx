/**
 * RFP Command Center - Frontend Application
 * Enterprise-Grade React Application with Full Feature Set
 */

import { useState, useEffect, createContext, useContext } from 'react';
import {
  BarChart3, FileText, CheckSquare, Bell, LogOut, Home, Plus,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Clock,
  Target,
  Settings,
  Search,
  Filter,
  ChevronDown
} from 'lucide-react';

// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ============================================
// AUTHENTICATION CONTEXT
// ============================================

// ============================================
// MOCK DATA & API FALLBACK (For Database-less Deployment)
// ============================================

const MOCK_STORAGE_KEY = 'rfp_mock_data';

const getMockData = () => {
  const data = localStorage.getItem(MOCK_STORAGE_KEY);
  return data ? JSON.parse(data) : {
    rfps: [
      {
        id: '1',
        rfpNumber: 'RFP-2024-001',
        clientName: 'Global Finance Corp',
        industry: 'Financial Services',
        projectTitle: 'Cloud Transformation Strategy',
        estimatedDealValue: 12500000,
        status: 'IN_PROGRESS',
        riskLevel: 'GREEN',
        submissionDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        completionPercentage: 65,
        proposalManager: { firstName: 'Sarah', lastName: 'Johnson' },
        tasks: [],
        milestones: []
      }
    ],
    user: { id: 'mock-user', firstName: 'Guest', lastName: 'User', email: 'guest@example.com', role: 'PROPOSAL_MANAGER' }
  };
};

const saveMockData = (data) => localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));

const apiCall = async (endpoint, options = {}, token, retryCount = 0) => {
  // Check if we should use mock data (if VITE_API_URL is not set or backend is unreachable)
  // Check if we should use mock data
  const isMockMode = import.meta.env.VITE_USE_MOCK === 'true';

  if (isMockMode) {
    console.warn('🚀 Running in Demo Mode (Mock API)');
    const mockData = getMockData();

    // Helper to get request body
    const body = options.body ? JSON.parse(options.body) : {};

    // 1. AUTHENTICATION MOCK
    if (endpoint === '/auth/me') return { user: mockData.user };
    if (endpoint === '/auth/register') {
      const newUser = { id: 'user-' + Date.now(), ...body, role: body.role || 'SOLUTION_ARCHITECT' };
      mockData.user = newUser;
      saveMockData(mockData);
      return { message: 'User registered', user: newUser, token: 'mock-token-' + Date.now() };
    }

    // 2. RFP MANAGEMENT MOCK
    if (endpoint === '/rfps') {
      if (options.method === 'POST') {
        const newRfp = {
          id: 'rfp-' + Date.now(),
          rfpNumber: 'RFP-' + (2024 + mockData.rfps.length).toString(),
          completionPercentage: 0,
          status: 'INTAKE',
          riskLevel: 'GREEN',
          proposalManager: mockData.user,
          tasks: [],
          milestones: [
            { id: 'm1', title: 'Kickoff', targetDate: new Date().toISOString(), isCompleted: true },
            { id: 'm2', title: 'Draft Submission', targetDate: new Date(Date.now() + 7 * 86400000).toISOString(), isCompleted: false }
          ],
          ...body
        };
        mockData.rfps.unshift(newRfp);
        saveMockData(mockData);
        return { message: 'RFP Created', rfp: newRfp };
      }
      return { rfps: mockData.rfps };
    }

    if (endpoint.startsWith('/rfps/')) {
      const id = endpoint.split('/').pop();
      const rfp = mockData.rfps.find(r => r.id === id);
      return { rfp: rfp || mockData.rfps[0] };
    }

    // 3. TASKS MOCK
    if (endpoint === '/tasks') {
      // Return flat list of all tasks from all RFPs
      const allTasks = mockData.rfps.flatMap(r => r.tasks.map(t => ({ ...t, rfp: { projectTitle: r.projectTitle } })));
      return { tasks: allTasks };
    }

    if (endpoint.startsWith('/tasks/')) {
      const id = endpoint.split('/').pop();
      if (options.method === 'PATCH') {
        mockData.rfps.forEach(r => {
          r.tasks = r.tasks.map(t => t.id === id ? { ...t, ...body } : t);
        });
        saveMockData(mockData);
        return { message: 'Task updated' };
      }
    }

    // 4. DASHBOARD MOCK
    if (endpoint === '/dashboard/executive') {
      const activeCount = mockData.rfps.filter(r => r.status !== 'WON' && r.status !== 'LOST').length;
      const totalValue = mockData.rfps.reduce((sum, r) => sum + (Number(r.estimatedDealValue) || 0), 0);
      return {
        kpis: {
          totalPipelineValue: totalValue,
          activeRFPs: activeCount,
          rfpsAtRisk: mockData.rfps.filter(r => r.riskLevel === 'RED').length,
          winRate: 68
        },
        charts: {
          statusDistribution: [
            { status: 'INTAKE', count: mockData.rfps.filter(r => r.status === 'INTAKE').length },
            { status: 'PLANNING', count: mockData.rfps.filter(r => r.status === 'PLANNING').length },
            { status: 'IN_PROGRESS', count: mockData.rfps.filter(r => r.status === 'IN_PROGRESS').length },
            { status: 'REVIEW', count: mockData.rfps.filter(r => r.status === 'REVIEW').length }
          ],
          riskDistribution: [
            { level: 'GREEN', count: mockData.rfps.filter(r => r.riskLevel === 'GREEN').length },
            { level: 'AMBER', count: mockData.rfps.filter(r => r.riskLevel === 'AMBER').length },
            { level: 'RED', count: mockData.rfps.filter(r => r.riskLevel === 'RED').length }
          ]
        },
        recentActivity: [
          { id: 'a1', action: 'RFP_CREATED', user: mockData.user, rfp: mockData.rfps[0], createdAt: new Date().toISOString() }
        ]
      };
    }

    if (endpoint === '/dashboard/my-rfps') return { unreadCount: 2 };

    return {}; // Default fallback
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 429 && retryCount < 3) {
      const waitTime = Math.pow(2, retryCount) * 1000;
      console.warn(`Rate limited. Retrying in ${waitTime}ms...`);
      await new Promise(res => setTimeout(res, waitTime));
      return apiCall(endpoint, options, token, retryCount + 1);
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'API request failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    if (retryCount < 3 && error.name !== 'TypeError') {
      await new Promise(res => setTimeout(res, 1000));
      return apiCall(endpoint, options, token, retryCount + 1);
    }
    throw error;
  }
};

// ============================================
// AUTHENTICATION CONTEXT
// ============================================

const AuthContext = createContext(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const data = await apiCall('/auth/me', {}, token);
      setUser(data.user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const isMockMode = import.meta.env.VITE_USE_MOCK === 'true';

    if (isMockMode) {
      const mockData = getMockData();
      const mockToken = 'mock-token-' + Date.now();
      setToken(mockToken);
      setUser(mockData.user);
      localStorage.setItem('token', mockToken);
      return { token: mockToken, user: mockData.user };
    }

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    const data = await response.json();
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('token', data.token);
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// ============================================
// LOGIN COMPONENT
// ============================================

const Login = () => {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await apiCall('/auth/register', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
        // After registration, auto-login
        await login(formData.email, formData.password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <div style={{ marginBottom: '2rem' }}>
          <div className="flex-center" style={{ marginBottom: '1.5rem' }}>
            <div style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)', color: 'white', padding: '1rem', borderRadius: '15px', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)' }}>
              <FileText size={42} />
            </div>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>Enterprise RFP</h1>
          <p style={{ color: '#64748b', marginTop: '0.5rem', fontWeight: 600 }}>Command Center Enterprise</p>
        </div>

        <div className="login-tabs">
          <button className={`login-tab ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)}>Sign In</button>
          <button className={`login-tab ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)}>Join Center</button>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input type="text" name="firstName" className="form-input" placeholder="First Name" value={formData.firstName} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input type="text" name="lastName" className="form-input" placeholder="Last Name" value={formData.lastName} onChange={handleChange} required />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Work Email</label>
            <input type="email" name="email" className="form-input" placeholder="name@company.com" value={formData.email} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" name="password" className="form-input" placeholder="••••••••" value={formData.password} onChange={handleChange} required />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}
            >
              {isLogin ? 'Need an account? Register' : 'Already registered? Sign In'}
            </button>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div className="spinner" style={{ width: '16px', height: '16px', margin: 0, borderWidth: '2px', borderTopColor: 'white' }}></div>
                Processing...
              </div>
            ) : (isLogin ? 'Sign Into Center' : 'Create Enterprise Account')}
          </button>
        </form>

        {error && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#fff1f2',
            color: '#e11d48',
            borderRadius: '0.75rem',
            fontSize: '0.9rem',
            fontWeight: 700,
            border: '1px solid #fda4af',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.3s ease-out'
          }}>
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>
            Enterprise Security Policy Active
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================
// RFP LIST COMPONENT
// ============================================

const RFPList = ({ initialRfps, loading: propLoading, onViewRFP, onCreateRFP, onRefresh }) => {
  const { token, user } = useAuth();
  const [rfps, setRfps] = useState(initialRfps || []);
  const [loading, setLoading] = useState(!initialRfps);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, RISK:*, STATUS:*, DATE:*

  useEffect(() => {
    if (initialRfps && !search) {
      setRfps(initialRfps);
      setLoading(propLoading);
    } else {
      fetchRFPs();
    }
  }, [initialRfps, propLoading, search]);

  const fetchRFPs = async () => {
    try {
      const endpoint = search ? `/rfps?search=${encodeURIComponent(search)}` : '/rfps';
      const data = await apiCall(endpoint, {}, token);
      setRfps(data.rfps);
    } catch (error) {
      console.error('Failed to fetch RFPs:', error);
    } finally {
      setLoading(false);
    }
  };

  const canCreate = user?.role === 'PROPOSAL_MANAGER' || user?.role === 'SOLUTION_ARCHITECT';

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '2.5rem', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>RFPs</h1>
          <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Manage your proposal pipeline</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={onCreateRFP} style={{ gap: '0.5rem' }}>
            <Plus size={20} />
            New Proposal
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search RFPs..."
              className="form-input"
              style={{ paddingLeft: '40px' }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <select 
              className="form-select" 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ appearance: 'none', paddingRight: '2rem', minWidth: '150px' }}
            >
              <option value="ALL">All RFPs</option>
              <optgroup label="By Risk">
                <option value="RISK:RED">High Risk (Red)</option>
                <option value="RISK:AMBER">Medium Risk (Amber)</option>
                <option value="RISK:GREEN">Low Risk (Green)</option>
              </optgroup>
              <optgroup label="By Status">
                <option value="STATUS:INTAKE">Intake</option>
                <option value="STATUS:PLANNING">Planning</option>
                <option value="STATUS:IN_PROGRESS">In Progress</option>
                <option value="STATUS:REVIEW">Review</option>
              </optgroup>
              <optgroup label="By Deadline">
                <option value="DATE:UPCOMING">Upcoming (Next 30 Days)</option>
                <option value="DATE:PAST">Past Deadline</option>
              </optgroup>
            </select>
            <Filter size={16} color="#64748b" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>RFP Title</th>
                <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Client</th>
                <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Value</th>
                <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Deadline</th>
                <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Risk</th>
                <th style={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Owner</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                  </td>
                </tr>
              ) : rfps.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '5rem 2rem', color: '#64748b' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No RFPs found</div>
                    <p>Create your first proposal to get started.</p>
                  </td>
                </tr>
              ) : (
                (() => {
                  const filteredList = rfps.filter(rfp => {
                    if (filterType === 'ALL') return true;
                    if (filterType.startsWith('RISK:')) return rfp.riskLevel === filterType.split(':')[1];
                    if (filterType.startsWith('STATUS:')) return rfp.status === filterType.split(':')[1];
                    if (filterType.startsWith('DATE:')) {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0); // Normalize to start of today
                      const deadline = new Date(rfp.submissionDeadline);
                      if (filterType === 'DATE:PAST') return deadline < today;
                      if (filterType === 'DATE:UPCOMING') {
                        const thirtyDays = new Date(today);
                        thirtyDays.setDate(thirtyDays.getDate() + 30);
                        return deadline >= today && deadline <= thirtyDays;
                      }
                    }
                    return true;
                  });

                  if (filteredList.length === 0) {
                    return (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '5rem 2rem', color: '#64748b' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No RFPs match criteria</div>
                          <p>Try adjusting your search or filter settings.</p>
                        </td>
                      </tr>
                    );
                  }

                  return filteredList.map((rfp) => (
                    <tr key={rfp.id} onClick={() => onViewRFP(rfp.id)} style={{ cursor: 'pointer' }} className="table-row-hover">
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>{rfp.projectTitle}</td>
                      <td style={{ color: '#475569' }}>{rfp.clientName}</td>
                      <td style={{ fontWeight: 700, color: '#10b981' }}>${(rfp.estimatedDealValue / 1000000).toFixed(1)}M</td>
                      <td style={{ color: '#475569' }}>{new Date(rfp.submissionDeadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td>
                        <span className={`status-badge status-${rfp.status.toLowerCase()}`}>
                          {rfp.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <span className={`risk-badge risk-${rfp.riskLevel.toLowerCase()}`}>
                          {rfp.riskLevel}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '28px', height: '28px', background: '#eff6ff', color: '#2563eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, border: '1px solid #dbeafe' }}>
                            {rfp.proposalManager?.firstName?.[0] || 'U'}
                          </div>
                          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{rfp.proposalManager?.firstName || 'Unknown'}</span>
                        </div>
                      </td>
                    </tr>
                  ));
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================
// RFP DETAIL COMPONENT
// ============================================

const RFPDetail = ({ rfpId, onBack }) => {
  const { token } = useAuth();
  const [rfp, setRfp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRFPDetail();
  }, [rfpId]);

  const fetchRFPDetail = async () => {
    try {
      const data = await apiCall(`/rfps/${rfpId}`, {}, token);
      setRfp(data.rfp);
    } catch (error) {
      console.error('Failed to fetch RFP:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (!rfp) {
    return <div className="empty-state">RFP not found</div>;
  }

  return (
    <div>
      <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: '2rem', gap: '8px' }}>
        ← Back to List
      </button>

      <div className="dashboard-sections">
        <div>
          {/* RFP Overview */}
          <div className="card">
            <div className="flex-between" style={{ alignItems: 'start', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                  {rfp.projectTitle}
                </h2>
                <p style={{ fontSize: '1.25rem', color: '#64748b', fontWeight: 500 }}>{rfp.clientName}</p>
              </div>
              <span className={`risk-badge risk-${rfp.riskLevel.toLowerCase()}`} style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
                {rfp.riskLevel} RISK
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem', fontWeight: 700, textTransform: 'uppercase' }}>RFP Number</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem', color: '#0f172a' }}>{rfp.rfpNumber}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem', fontWeight: 700, textTransform: 'uppercase' }}>Industry</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#0f172a' }}>{rfp.industry}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem', fontWeight: 700, textTransform: 'uppercase' }}>Deal Value</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#10b981' }}>${(rfp.estimatedDealValue / 1000000).toFixed(2)}M</div>
              </div>
            </div>

            {rfp.executiveSummary && (
              <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '0.75rem', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
                <h4 style={{ fontWeight: 800, marginBottom: '0.75rem', color: '#0f172a' }}>Executive Summary</h4>
                <p style={{ color: '#475569', lineHeight: 1.7, fontSize: '1.05rem' }}>{rfp.executiveSummary}</p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: 600 }}>Proposal Manager</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', background: '#2563eb', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                    {rfp.proposalManager.firstName?.[0]}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                    {rfp.proposalManager.firstName} {rfp.proposalManager.lastName}
                  </div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: 600 }}>Solution Architect</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '100px' }}>
                  {rfp.solutionArchitect ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', background: '#8b5cf6', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                        {rfp.solutionArchitect.firstName?.[0]}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                        {rfp.solutionArchitect.firstName} {rfp.solutionArchitect.lastName}
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not Assigned</span>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Tasks */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '1.5rem' }}>
            <div style={{ padding: '1.75rem', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontWeight: 800 }}>Tasks</h3>
            </div>
            {rfp.tasks.length === 0 ? (
              <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>No tasks yet</div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: '2rem' }}>Task</th>
                      <th>Owner</th>
                      <th>Due Date</th>
                      <th style={{ paddingRight: '2rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rfp.tasks.map((task) => (
                      <tr key={task.id} className="table-row-hover">
                        <td style={{ paddingLeft: '2rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{task.title}</div>
                          {task.description && (
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                              {task.description}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '24px', height: '24px', background: '#f1f5f9', color: '#475569', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>
                              {task.owner.firstName?.[0]}
                            </div>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{task.owner.firstName}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: task.isOverdue ? '#ef4444' : '#64748b', fontWeight: task.isOverdue ? 700 : 400 }}>
                            <Clock size={14} />
                            {new Date(task.dueDate).toLocaleDateString()}
                          </div>
                        </td>
                        <td style={{ paddingRight: '2rem' }}>
                          <span className={`status-badge status-${task.status.toLowerCase()}`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Status & Milestones */}
          <div className="card">
            <h4 style={{ fontWeight: 800, marginBottom: '1.5rem', color: '#0f172a' }}>Progress</h4>

            <div style={{ marginBottom: '2rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Current Status</div>
              <span className={`status-badge status-${rfp.status.toLowerCase()}`} style={{ fontSize: '0.85rem', padding: '0.6rem 1.25rem' }}>
                {rfp.status.replace('_', ' ')}
              </span>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Completion</div>
                <div style={{ fontWeight: 800, color: '#2563eb' }}>{rfp.completionPercentage}%</div>
              </div>
              <div style={{
                height: '10px',
                background: '#f1f5f9',
                borderRadius: '5px',
                overflow: 'hidden',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{
                  height: '100%',
                  width: `${rfp.completionPercentage}%`,
                  background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
                  transition: 'width 0.4s ease'
                }}></div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Deadline</div>
              <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0f172a' }}>
                {new Date(rfp.submissionDeadline).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              <div style={{ fontSize: '0.9rem', color: rfp.daysRemaining < 7 ? '#ef4444' : '#64748b', marginTop: '0.5rem', fontWeight: 600 }}>
                {Math.max(0, Math.ceil((new Date(rfp.submissionDeadline) - new Date()) / (1000 * 60 * 60 * 24)))} days remaining
              </div>
            </div>
          </div>

          {/* Milestones */}
          <div className="card">
            <h4 style={{ fontWeight: 800, marginBottom: '1.5rem', color: '#0f172a' }}>Milestones</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {rfp.milestones.map((milestone, index) => (
                <div key={milestone.id} style={{
                  display: 'flex',
                  gap: '1rem',
                  position: 'relative',
                  paddingBottom: index < rfp.milestones.length - 1 ? '1.25rem' : 0
                }}>
                  {index < rfp.milestones.length - 1 && (
                    <div style={{ position: 'absolute', left: '10px', top: '24px', bottom: 0, width: '2px', background: '#f1f5f9' }}></div>
                  )}
                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: milestone.isCompleted ? '#10b981' : 'white',
                    border: `2px solid ${milestone.isCompleted ? '#10b981' : '#cbd5e1'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1,
                    flexShrink: 0
                  }}>
                    {milestone.isCompleted && (
                      <div style={{ width: '8px', height: '4px', borderLeft: '2px solid white', borderBottom: '2px solid white', transform: 'rotate(-45deg) translate(1px, -1px)' }}></div>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: milestone.isCompleted ? '#64748b' : '#0f172a' }}>{milestone.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                      {new Date(milestone.targetDate).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// CREATE RFP COMPONENT
// ============================================

const CreateRFPForm = ({ onCancel, onSuccess }) => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    clientName: '',
    industry: '',
    projectTitle: '',
    executiveSummary: '',
    submissionDeadline: '',
    estimatedDealValue: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rawDocument, setRawDocument] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  const handleAIGenerate = async () => {
    if (!rawDocument.trim()) {
      setError('Please provide raw document text to analyze.');
      return;
    }
    
    setAiGenerating(true);
    setError('');
    
    try {
      // In mock mode or real mode, hook up to backend
      const response = await fetch(`${API_URL}/ai/analyze-rfp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ documentText: rawDocument })
      });

      if (!response.ok) {
        throw new Error('AI Generation failed. Ensure Gemini API key is configured.');
      }

      const data = await response.json();
      setFormData(prev => ({ ...prev, executiveSummary: data.result }));
    } catch (err) {
      setError(err.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await apiCall('/rfps', {
        method: 'POST',
        body: JSON.stringify(formData)
      }, token);

      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '2rem', color: '#0f172a' }}>Create New RFP</h2>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">Client Name *</label>
            <input
              type="text"
              name="clientName"
              className="form-input"
              placeholder="e.g. Acme Corp"
              value={formData.clientName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Industry *</label>
            <select
              name="industry"
              className="form-select"
              value={formData.industry}
              onChange={handleChange}
              required
            >
              <option value="">Select Industry</option>
              <option value="Financial Services">Financial Services</option>
              <option value="Technology">Technology</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Retail">Retail</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Energy">Energy</option>
              <option value="Government">Government</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Project Title *</label>
          <input
            type="text"
            name="projectTitle"
            className="form-input"
            placeholder="e.g. Digital Transformation 2024"
            value={formData.projectTitle}
            onChange={handleChange}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Raw Document / Context</label>
            </div>
            <textarea
              className="form-textarea"
              placeholder="Paste the 150-page RFP text here, or a short 5-page request..."
              rows="8"
              value={rawDocument}
              onChange={(e) => setRawDocument(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
            />
            <button 
              type="button" 
              onClick={handleAIGenerate}
              disabled={aiGenerating}
              style={{ 
                marginTop: '0.75rem', width: '100%', padding: '0.75rem', background: 'linear-gradient(145deg, #1e1b4b, #312e81)', 
                color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 800, cursor: aiGenerating ? 'not-allowed' : 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>✨</span>
              {aiGenerating ? 'AI is analyzing document...' : 'AI Generate Summary'}
            </button>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Executive Summary</label>
            <textarea
              name="executiveSummary"
              className="form-textarea"
              placeholder="The summarized (or elaborated) proposal will appear here..."
              rows="10"
              value={formData.executiveSummary}
              onChange={handleChange}
              style={{ height: 'calc(100% - 28px)' }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">Submission Deadline *</label>
            <input
              type="date"
              name="submissionDeadline"
              className="form-input"
              value={formData.submissionDeadline}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Estimated Deal Value ($)</label>
            <input
              type="number"
              name="estimatedDealValue"
              className="form-input"
              placeholder="e.g. 5000000"
              value={formData.estimatedDealValue}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {error && (
          <div style={{
            padding: '1rem',
            background: '#fff1f2',
            color: '#e11d48',
            borderRadius: '0.65rem',
            marginBottom: '1.5rem',
            border: '1px solid #fda4af',
            fontWeight: 700,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
            {loading ? 'Creating...' : 'Create Proposal'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel} style={{ flex: 1 }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================
// TASKS VIEW COMPONENT
// ============================================

const TasksView = ({ initialTasks, loading: propLoading, onRefresh }) => {
  const { token, user } = useAuth();
  const [tasks, setTasks] = useState(initialTasks || []);
  const [loading, setLoading] = useState(!initialTasks);
  const [filter, setFilter] = useState('ALL'); // ALL, PENDING, COMPLETED

  useEffect(() => {
    if (initialTasks) {
      setTasks(initialTasks);
      setLoading(propLoading);
    } else {
      fetchTasks();
    }
  }, [initialTasks, propLoading]);

  const fetchTasks = async () => {
    try {
      const data = await apiCall('/tasks', {}, token);
      setTasks(data.tasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTask = async (task) => {
    // Optimistic UI update
    const newStatus = task.status === 'COMPLETED' ? 'IN_PROGRESS' : 'COMPLETED';
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    try {
      await apiCall(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      }, token);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to update task:', error);
      // Rollback on error
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'PENDING') return task.status !== 'COMPLETED';
    if (filter === 'COMPLETED') return task.status === 'COMPLETED';
    return true;
  });

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>My Tasks</h1>
          <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Aggregated workload across all active proposals</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.4rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
          <button
            className={`btn ${filter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('ALL')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >All</button>
          <button
            className={`btn ${filter === 'PENDING' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('PENDING')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >Pending</button>
          <button
            className={`btn ${filter === 'COMPLETED' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('COMPLETED')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >Completed</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '48px' }}></th>
                <th>Task Title</th>
                <th>RFP Project</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '5rem 2rem', color: '#64748b' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No tasks found</div>
                    <p>Tasks assigned to you will appear here.</p>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr key={task.id} className="table-row-hover">
                    <td style={{ paddingLeft: '1.5rem' }}>
                      <input
                        type="checkbox"
                        checked={task.status === 'COMPLETED'}
                        onChange={() => handleToggleTask(task)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ fontWeight: 700, color: task.status === 'COMPLETED' ? '#94a3b8' : '#0f172a', textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none' }}>
                      {task.title}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={14} color="#64748b" />
                        <span style={{ fontSize: '0.9rem', color: '#475569' }}>{task.rfp.projectTitle}</span>
                      </div>
                    </td>
                    <td style={{ color: task.isOverdue && task.status !== 'COMPLETED' ? '#ef4444' : '#64748b', fontWeight: task.isOverdue && task.status !== 'COMPLETED' ? 700 : 400 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge status-${task.status.toLowerCase().replace(' ', '_')}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {task.isEscalated ? (
                        <span className="risk-badge risk-red">High Priority</span>
                      ) : (
                        <span className="risk-badge risk-green">Normal</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============================================
// ANALYTICS VIEW COMPONENT
// ============================================

const Dashboard = ({ data: propData, loading: propLoading, onRefresh }) => {
  const { token } = useAuth();
  const [internalData, setInternalData] = useState(null);
  const [internalLoading, setInternalLoading] = useState(true);

  // Use props if available, otherwise use internal state
  const data = propData || internalData;
  const loading = propData ? propLoading : internalLoading;

  useEffect(() => {
    if (!propData) {
      fetchDashboardData();
    }
  }, [propData]);

  const fetchDashboardData = async () => {
    try {
      const result = await apiCall('/dashboard/executive', {}, token);
      setInternalData(result);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setInternalLoading(false);
    }
  };

  if (loading || !data) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a' }}>Executive Overview</h1>
        <p style={{ color: '#64748b', marginTop: '0.5rem', fontSize: '1.1rem' }}>Real-time insights into proposal pipeline and performance.</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card-new blue">
          <div className="kpi-header">
            <span>Pipeline Value</span>
            <DollarSign size={20} color="#2563eb" />
          </div>
          <div className="kpi-value-new">${(data.kpis.totalPipelineValue / 1000000).toFixed(1)}M</div>
          <div className="kpi-footer" style={{ color: '#10b981' }}>↗ +12% from last month</div>
        </div>
        <div className="kpi-card-new purple">
          <div className="kpi-header">
            <span>Active RFPs</span>
            <FileText size={20} color="#8b5cf6" />
          </div>
          <div className="kpi-value-new">{data.kpis.activeRFPs}</div>
          <div className="kpi-footer">Currently in progress</div>
        </div>
        <div className="kpi-card-new red">
          <div className="kpi-header">
            <span>At Risk</span>
            <AlertTriangle size={20} color="#ef4444" />
          </div>
          <div className="kpi-value-new">{data.kpis.rfpsAtRisk}</div>
          <div className="kpi-footer">Requiring immediate attention</div>
        </div>
        <div className="kpi-card-new green">
          <div className="kpi-header">
            <span>Win Rate</span>
            <TrendingUp size={20} color="#10b981" />
          </div>
          <div className="kpi-value-new">{data.kpis.winRate}%</div>
          <div className="kpi-footer">Based on last 12 months</div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <h3 style={{ fontWeight: 800 }}>RFP Volume by Status</h3>
          </div>
          <div style={{ height: '320px', display: 'flex', alignItems: 'flex-end', gap: '2rem', paddingTop: '1rem', paddingBottom: '1rem' }}>
            {data.charts.statusDistribution.map(item => (
              <div key={item.status} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: '36px',
                    height: `${(item.count / Math.max(...data.charts.statusDistribution.map(i => i.count), 1)) * 240}px`,
                    background: 'linear-gradient(180deg, #2563eb 0%, #3b82f6 100%)',
                    borderRadius: '8px 8px 0 0',
                    transition: 'height 0.4s ease',
                    border: '1px solid rgba(0,0,0,0.05)'
                  }}></div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, marginTop: '0.75rem', color: '#0f172a' }}>{item.count}</div>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                  {item.status.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Risk Distribution</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>Current risk assessment of active RFPs</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {data.charts.riskDistribution.map(risk => (
              <div key={risk.level}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: 800, color: risk.level === 'RED' ? '#ef4444' : risk.level === 'AMBER' ? '#f59e0b' : '#10b981' }}>{risk.level}</span>
                  <span style={{ fontWeight: 800 }}>{risk.count} RFPs</span>
                </div>
                <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <div style={{
                    height: '100%',
                    width: `${(risk.count / data.kpis.activeRFPs) * 100}%`,
                    background: risk.level === 'RED' ? '#ef4444' : risk.level === 'AMBER' ? '#f59e0b' : '#10b981'
                  }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ fontWeight: 800, marginBottom: '2rem' }}>Recent Activity</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {data.recentActivity.slice(0, 5).map((activity, idx) => (
            <div key={activity.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem', paddingBottom: '1.25rem', borderBottom: idx < 4 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ padding: '0.6rem', background: '#eff6ff', borderRadius: '10px', color: '#2563eb', border: '1px solid #dbeafe' }}>
                <Clock size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                  <span style={{ color: '#2563eb', fontWeight: 800 }}>{activity.user.firstName} {activity.user.lastName}</span>
                  {' '}<span style={{ color: '#475569' }}>{activity.action.toLowerCase().replace('_', ' ')}</span>
                  {activity.rfp && <span> on <span style={{ color: '#0f172a', fontWeight: 700 }}>{activity.rfp.clientName}</span></span>}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>{new Date(activity.createdAt).toLocaleTimeString()}</span>
                  <span>•</span>
                  <span>{new Date(activity.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
const SettingsView = () => {
  const { user } = useAuth();
  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Settings</h1>
        <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Manage your account and preferences</p>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontWeight: 800, marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>Profile Settings</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div className="form-group">
            <label className="form-label">First Name</label>
            <input type="text" className="form-input" value={user?.firstName} disabled style={{ fontWeight: 600 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Last Name</label>
            <input type="text" className="form-input" value={user?.lastName} disabled style={{ fontWeight: 600 }} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Email Address</label>
            <input type="email" className="form-input" value={user?.email} disabled style={{ fontWeight: 600 }} />
          </div>
          <div className="form-group">
            <label className="form-label">System Role</label>
            <div style={{ padding: '0.875rem 1rem', background: '#f8fafc', borderRadius: '0.65rem', fontWeight: 800, border: 'var(--border-fine)', color: '#2563eb', fontSize: '0.9rem', display: 'inline-block' }}>
              {user?.role?.replace('_', ' ')}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontWeight: 800, marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>Organization</h3>
        <div className="form-group">
          <label className="form-label">Organization Name</label>
          <input type="text" className="form-input" value="Enterprise" disabled style={{ fontWeight: 600 }} />
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontWeight: 800, marginBottom: '2rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>Security</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Keep your account secure by updating your password regularly.</p>
          <button className="btn btn-secondary" style={{ color: '#2563eb', fontWeight: 800 }}>
            Change Password
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN APP COMPONENT
// ============================================

const AppLayout = () => {
  const { user, logout, token } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedRFPId, setSelectedRFPId] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [rfpsData, setRfpsData] = useState([]);
  const [tasksData, setTasksData] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (token) fetchInitialData();
  }, [token]);

  const fetchInitialData = async () => {
    try {
      const [dash, rfps, tasks, notify] = await Promise.all([
        apiCall('/dashboard/executive', {}, token),
        apiCall('/rfps', {}, token),
        apiCall('/tasks', {}, token),
        apiCall('/dashboard/my-rfps', {}, token)
      ]);
      setDashboardData(dash);
      setRfpsData(rfps.rfps);
      setTasksData(tasks.tasks);
      setUnreadCount(notify.unreadCount || 0);
    } catch (error) {
      console.error('Failed to pre-fetch data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const refreshDashboard = async () => {
    const dash = await apiCall('/dashboard/executive', {}, token);
    setDashboardData(dash);
  };

  const refreshRFPs = async () => {
    const rfps = await apiCall('/rfps', {}, token);
    setRfpsData(rfps.rfps);
  };

  const refreshTasks = async () => {
    const tasks = await apiCall('/tasks', {}, token);
    setTasksData(tasks.tasks);
  };

  const navigation = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'rfps', label: 'RFPs', icon: FileText },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare }
  ];

  const handleViewRFP = (rfpId) => {
    setSelectedRFPId(rfpId);
    setCurrentView('rfp-detail');
  };

  const handleBackToList = () => {
    setCurrentView('rfps');
    setSelectedRFPId(null);
  };

  const handleCreateRFP = () => {
    setCurrentView('create-rfp');
  };

  const handleRFPCreated = () => {
    setCurrentView('rfps');
  };


  const [showLogout, setShowLogout] = useState(false);

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header" onClick={() => { setCurrentView('dashboard'); setSelectedRFPId(null); }} style={{ cursor: 'pointer' }}>
          <div className="sidebar-logo">
            <FileText size={20} />
          </div>
          <h1 className="sidebar-title">RFP Command</h1>
        </div>

        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${currentView === item.id || (currentView === 'rfp-detail' && item.id === 'rfps') ? 'active' : ''}`}
                onClick={() => setCurrentView(item.id)}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
          <button className={`nav-item ${currentView === 'settings' ? 'active' : ''}`} onClick={() => setCurrentView('settings')}>
            <Settings size={20} />
            Settings
          </button>
        </nav>

        <div className="sidebar-footer" style={{ borderTop: 'var(--border-fine)' }}>
          <div className="team-status-card" style={{ border: 'var(--border-fine)', background: 'white' }}>
            <div style={{ textTransform: 'uppercase', fontSize: '0.65rem', color: '#64748b', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '0.05em' }}>System Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
              <span className="status-dot active" style={{ width: '8px', height: '8px' }}></span>
              All Systems Operational
            </div>
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: '38px', height: '38px', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}>
                {user?.firstName?.[0] || 'U'}
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.firstName} {user?.lastName}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{user?.role?.replace('_', ' ')}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div style={{ fontWeight: 600, color: '#64748b' }}>
            {currentView === 'dashboard' ? 'Dashboard' :
              currentView === 'rfps' ? 'RFPs' :
                currentView === 'tasks' ? 'Tasks' :
                  currentView === 'settings' ? 'Settings' :
                    currentView === 'rfp-detail' ? 'RFPs' : 'Dashboard'}
          </div>

          <div className="topbar-right">
            <div style={{ position: 'relative', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px' }}>
              <Bell size={22} color="#64748b" />
              <span style={{ position: 'absolute', top: 2, right: 2, background: '#ef4444', color: 'white', width: '18px', height: '18px', borderRadius: '50%', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, border: '2px solid white' }}>
                {unreadCount > 0 ? unreadCount : 2}
              </span>
            </div>

            <div style={{ height: '24px', width: '1px', background: '#e2e8f0', margin: '0 0.5rem' }}></div>

            <div style={{ position: 'relative' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', padding: '0.4rem 0.75rem', borderRadius: '10px', border: 'var(--border-fine)', background: '#f8fafc' }}
                onClick={() => setShowLogout(!showLogout)}
              >
                <div style={{ textAlign: 'right', display: 'block' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>{user?.firstName} {user?.lastName}</div>
                  <div style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{user?.role?.replace('_', ' ')}</div>
                </div>
                <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'white', fontSize: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {user?.firstName?.[0] || 'U'}
                </div>
                <ChevronDown size={16} color="#64748b" />
              </div>

              {showLogout && (
                <div style={{
                  position: 'absolute',
                  top: '120%',
                  right: 0,
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  padding: '4px',
                  minWidth: '160px',
                  border: '1px solid #f1f5f9',
                  zIndex: 100
                }}>
                  <button
                    onClick={logout}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      borderRadius: '6px'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#fff1f2'}
                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                  >
                    <LogOut size={16} />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content-area">
          <div className={`view-container ${currentView === 'dashboard' ? '' : 'hidden'}`}>
            <Dashboard data={dashboardData} loading={dataLoading} onRefresh={refreshDashboard} />
          </div>
          <div className={`view-container ${currentView === 'rfps' ? '' : 'hidden'}`}>
            <RFPList initialRfps={rfpsData} loading={dataLoading} onViewRFP={handleViewRFP} onCreateRFP={handleCreateRFP} onRefresh={refreshRFPs} />
          </div>
          <div className={`view-container ${currentView === 'tasks' ? '' : 'hidden'}`}>
            <TasksView initialTasks={tasksData} loading={dataLoading} onRefresh={refreshTasks} />
          </div>

          {currentView === 'rfp-detail' && (
            <RFPDetail rfpId={selectedRFPId} onBack={handleBackToList} onUpdate={fetchInitialData} />
          )}
          {currentView === 'create-rfp' && (
            <CreateRFPForm onCancel={handleBackToList} onSuccess={() => {
              fetchInitialData();
              handleRFPCreated();
            }} />
          )}
          {currentView === 'settings' && (
            <SettingsView />
          )}
        </div>
      </main>
    </div>
  );
};

// ============================================
// ROOT APP COMPONENT
// ============================================

function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

function MainApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)'
      }}>
        <div className="spinner" style={{ borderTopColor: 'white' }}></div>
      </div>
    );
  }

  return user ? <AppLayout /> : <Login />;
}

export default App;
