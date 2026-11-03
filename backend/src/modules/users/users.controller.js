const usersService = require('./users.service');

async function listUsers(req, res) {
  const { users, pagination } = await usersService.listUsers(req.validatedQuery);
  res.status(200).json({ users, pagination });
}

async function updateUser(req, res) {
  const user = await usersService.updateUser(req.params.id, req.user.id, req.body);
  res.status(200).json({ user });
}

module.exports = { listUsers, updateUser };
