import { AppError } from '../../errors/AppError.js'

const PROFILE_FIELDS = 'id, full_name, email, phone, username, user_role, profile_completed, created_at, updated_at'

function repositoryError(error) {
  if (error?.code === '23505') return AppError.conflict('PROFILE_CONFLICT', 'Email or username is already in use')
  return new AppError(500, 'PROFILE_QUERY_FAILED', 'Unable to access user profile')
}

export class UserRepository {
  constructor(forAccessToken) {
    this.forAccessToken = forAccessToken
  }

  async findById(userId, accessToken) {
    const { data, error } = await this.forAccessToken(accessToken)
      .from('users')
      .select(PROFILE_FIELDS)
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) throw repositoryError(error)
    return data
  }

  async updateOwnProfile(userId, changes, accessToken) {
    const { data, error } = await this.forAccessToken(accessToken)
      .from('users')
      .update(changes)
      .eq('id', userId)
      .is('deleted_at', null)
      .select(PROFILE_FIELDS)
      .maybeSingle()

    if (error) throw repositoryError(error)
    return data
  }
}
