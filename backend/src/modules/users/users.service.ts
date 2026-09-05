import { usersRepository, UserDirectoryRow } from './users.repository';

export const usersService = {
  /** No pagination — this is a small internal directory used for name lookups (approver/assignee display). */
  async list(): Promise<UserDirectoryRow[]> {
    return usersRepository.list();
  },
};
