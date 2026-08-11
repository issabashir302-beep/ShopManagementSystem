import { AppError } from '../../errors/AppError.js'

function toPublicProfile(profile) {
  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    username: profile.username,
    userRole: profile.user_role,
    profileCompleted: profile.profile_completed,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at
  }
}

export class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository
  }

  async getOwnProfile(auth) {
    const profile = await this.userRepository.findById(auth.userId, auth.token)
    if (!profile) throw AppError.notFound('PROFILE_NOT_FOUND', 'User profile was not found')
    return toPublicProfile(profile)
  }

  async updateOwnProfile(auth, changes) {
    const profile = await this.userRepository.updateOwnProfile(auth.userId, changes, auth.token)
    if (!profile) throw AppError.notFound('PROFILE_NOT_FOUND', 'User profile was not found')
    return toPublicProfile(profile)
  }
}
