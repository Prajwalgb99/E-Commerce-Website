import * as authService from './auth.service.js';

// Express 5 forwards rejected promises to the error handler, so no try/catch needed here.
export const register = async (req, res) => {
  res.status(201).json(await authService.register(req.body));
};

export const login = async (req, res) => {
  res.json(await authService.login(req.body));
};

export const refresh = async (req, res) => {
  res.json(await authService.refresh(req.body.refreshToken));
};

export const logout = async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(204).end();
};
