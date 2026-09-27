const express = require('express');
const http = require('http'); // 1. Required to wrap Express for Socket.IO
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./Database/db'); 
const productRoutes = require('./routes/ProductRoutes');
const userRoutes = require('./routes/UserRoutes');
const AdminRoutes = require('./routes/AdminRoutes');
const ContactRoutes = require('./routes/ContactRoutes');
const orderRoutes = require('./routes/OrderRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');

const app = express();
const server = http.createServer(app); // 2. Create the HTTP server wrapper

connectDB();

const allowedOrigins = [
  'https://online-shopping-front-end.vercel.app',
  'https://online-shopping-front-end.vercel.app/',
  'https://online-craft-shopping-front-end.vercel.app',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Initialize Socket.IO and attach it to Express app
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH']
  }
});

app.set('io', io);

// Register API Routes
app.use('/api', productRoutes);
app.use('/api', userRoutes);
app.use("/api", AdminRoutes);
app.use("/api", ContactRoutes);
app.use('/api', orderRoutes);
app.use('/api', whatsappRoutes);

// Socket.io Connection Listener
io.on('connection', (socket) => {
  console.log('Admin connected:', socket.id);
});

// 4. 404 Handler (Triggers for any route that isn't defined above)
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

// 5. Global Error Handling Middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

// 6. CRITICAL: Listen on `server`, NOT `app`
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));