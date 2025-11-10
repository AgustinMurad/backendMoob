import { MongooseModuleOptions } from '@nestjs/mongoose';

export const getDatabaseConfig = (): MongooseModuleOptions => ({
  uri: process.env.MONGODB_URI,
  retryAttempts: 3,
  retryDelay: 1000,
  connectionFactory: (connection) => {
    connection.on('connected', () => {
      console.log('✅ MongoDB connected successfully');
    });
    connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
    });
    connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected');
    });
    return connection;
  },
});
