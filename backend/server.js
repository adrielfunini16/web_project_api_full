require('dotenv').config();

const app = require('./app');
const mongooseConnect = require('./db');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await mongooseConnect();

    app.listen(PORT, () => {
      console.log(`Server is running on port: ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
