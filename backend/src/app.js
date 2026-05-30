const express = require('express');
const cors = require('cors');
const userStatusTypeRoutes = require('./routes/userStatusTypeRoutes');
const roleTypeRoutes = require('./routes/roleTypeRoutes');
const actionTypeRoutes = require('./routes/actionTypeRoutes');
const resourceTypeRoutes = require('./routes/resourceTypeRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const roleRoutes = require('./routes/roleRoutes');
const userRoutes = require('./routes/userRoutes');
const userRoleRoutes = require('./routes/userRoleRoutes');
const rolePermissionRoutes = require('./routes/rolePermissionRoutes');
const userPermissionRoutes = require('./routes/userPermissionRoutes');
const authRoutes = require('./routes/authRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const auditMiddleware = require('./middleware/auditMiddleware');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Audit Middleware — automatically captures every API request/response
// Must be registered after CORS/JSON but before routes
app.use(auditMiddleware);

// Routes configuration
app.use('/api/user-status-types', userStatusTypeRoutes);
app.use('/api/role-types', roleTypeRoutes);
app.use('/api/action-types', actionTypeRoutes);
app.use('/api/resource-types', resourceTypeRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user-roles', userRoleRoutes);
app.use('/api/role-permissions', rolePermissionRoutes);
app.use('/api/user-permissions', userPermissionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/audit-logs', auditLogRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    status: 'healthy', 
    timestamp: new Date().toISOString() 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'An unexpected server error occurred.',
    error: err.message 
  });
});

// 404 Route handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: `Endpoint ${req.method} ${req.originalUrl} not found.` 
  });
});

module.exports = app;
