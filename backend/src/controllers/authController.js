const authService = require('../services/authService');

class AuthController {
  async signup(req, res) {
    try {
      const { email, password, display_name, first_name, last_name } = req.body;
      const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';

      const result = await authService.signup({
        email,
        password,
        display_name,
        first_name,
        last_name,
        ip_address: clientIp
      });

      return res.status(201).json({
        success: true,
        message: 'Account registered successfully. An email verification token has been generated.',
        data: result
      });
    } catch (error) {
      console.error('Error in auth signup:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown';

      const result = await authService.login({
        email,
        password,
        ip_address: clientIp,
        user_agent: userAgent
      });

      return res.status(200).json({
        success: true,
        message: 'Logged in successfully.',
        data: result
      });
    } catch (error) {
      console.error('Error in auth login:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async logout(req, res) {
    try {
      const authHeader = req.headers.authorization;
      const sessionToken = authHeader && authHeader.split(' ')[1]; // Expecting "Bearer <token>"

      if (sessionToken) {
        await authService.logout(sessionToken);
      }

      return res.status(200).json({
        success: true,
        message: 'Logged out successfully.'
      });
    } catch (error) {
      console.error('Error in auth logout:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);

      return res.status(200).json({
        success: true,
        message: 'Recovery token generated successfully.',
        data: result
      });
    } catch (error) {
      console.error('Error in auth forgotPassword:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;
      const result = await authService.resetPassword({ token, newPassword });

      return res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Error in auth resetPassword:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // Session verification middleware helper route
  async verifySession(req, res) {
    try {
      const authHeader = req.headers.authorization;
      const sessionToken = authHeader && authHeader.split(' ')[1];

      if (!sessionToken) {
        return res.status(401).json({ success: false, message: 'Authorization token required.' });
      }

      const user = await authService.validateSession(sessionToken);
      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          security_clearance: user.security_clearance
        }
      });
    } catch (error) {
      return res.status(401).json({ success: false, message: error.message });
    }
  }
}

module.exports = new AuthController();
