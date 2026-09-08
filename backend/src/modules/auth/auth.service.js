import { AppError } from '../../errors/AppError.js'

function dependencyFailure(error) {
  const message = `${error?.message || ''} ${error?.cause?.message || ''}`.toLowerCase()
  return !error || error.status === 0 || error.status >= 500 || /fetch|network|eai_again|timeout/.test(message)
}

function authDependencyUnavailable(error) {
  const unavailable = new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Authentication service is temporarily unavailable')
  unavailable.cause = error
  return unavailable
}

function publicSession(session, user) {
  return {
    user: { id: user.id, email: user.email ?? null },
    session: session
      ? {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at,
          tokenType: session.token_type
        }
      : null
  }
}

export class AuthService {
  constructor({ publicClient, adminClient, forAccessToken, logger }) {
    this.publicClient = publicClient
    this.adminClient = adminClient
    this.forAccessToken = forAccessToken
    this.logger = logger
  }

  async signup(input) {
    const { data, error } = await this.publicClient.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName,
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.username ? { username: input.username } : {})
        }
      }
    })

    if (error || !data.user) {
      if (error?.message?.toLowerCase().includes('already')) {
        throw AppError.conflict(
          'ACCOUNT_ALREADY_EXISTS',
          'An account with this email already exists'
        )
      }
      throw AppError.badRequest('SIGNUP_FAILED', 'Unable to create account')
    }

    const { data: profile, error: profileError } = await this.adminClient
      .from('users')
      .select('id, user_role')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profileError || !profile || profile.user_role !== 'owner') {
      const { error: cleanupError } = await this.adminClient.auth.admin.deleteUser(data.user.id)
      if (cleanupError) {
        this.logger.error('signup_compensation_failed', {
          userId: data.user.id,
          error: new Error('Unable to remove inconsistent Auth identity')
        })
      }
      throw new AppError(500, 'PROFILE_CREATION_FAILED', 'Account setup could not be completed')
    }

    return {
      ...publicSession(data.session, data.user),
      profile: { id: profile.id, userRole: profile.user_role }
    }
  }

  async login(input) {
    const { data, error } = await this.publicClient.auth.signInWithPassword(input)
    if (error || !data.user || !data.session) {
      throw AppError.unauthorized('Invalid email or password')
    }
    return publicSession(data.session, data.user)
  }

  async refresh(refreshToken) {
    const { data, error } = await this.publicClient.auth.refreshSession({
      refresh_token: refreshToken
    })
    if (error && dependencyFailure(error)) throw authDependencyUnavailable(error)
    if (error || !data.user || !data.session)
      throw AppError.unauthorized('Invalid or expired refresh token')
    return publicSession(data.session, data.user)
  }

  async verifyAccessToken(accessToken) {
    const client = this.forAccessToken(accessToken)
    const { data, error } = await client.auth.getUser()
    if (error && dependencyFailure(error)) throw authDependencyUnavailable(error)
    if (error || !data.user) throw AppError.unauthorized('Invalid or expired access token')
    return { id: data.user.id, email: data.user.email }
  }

  async logout(accessToken) {
    const client = this.forAccessToken(accessToken)
    const { error } = await client.auth.signOut({ scope: 'global' })
    if (error) throw AppError.unauthorized('Unable to revoke the current session')
    return { message: 'Session revoked' }
  }
}
