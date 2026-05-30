const crypto = require('crypto');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../database.sqlite'),
  logging: false
});

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, primaryKey: true },
  email: DataTypes.STRING,
  password_hash: DataTypes.STRING,
  salt: DataTypes.STRING
}, { tableName: 'users', timestamps: false, paranoid: false });

async function resetAdminPassword() {
  const email = 'root-administrator@system.local';
  const password = 'SuperAdmin@123';

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');

  const [updated] = await User.update(
    { password_hash: hash, salt },
    { where: { email } }
  );

  if (updated) {
    console.log('✅ Password reset successful!');
    console.log('');
    console.log('  Email:    root-administrator@system.local');
    console.log('  Password: SuperAdmin@123');
    console.log('');
    console.log('You can now log in at http://localhost:8081');
  } else {
    console.log('❌ User not found in the database.');
  }

  await sequelize.close();
}

resetAdminPassword().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
