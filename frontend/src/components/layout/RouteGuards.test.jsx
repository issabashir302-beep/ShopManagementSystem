import { describe, expect, it } from 'vitest'
import { workspaceForRole } from './RouteGuards'

describe('role routing', () => {
  it('sends owners to the owner workspace', () => {
    expect(workspaceForRole('owner')).toBe('/app')
  })

  it('never sends a shopkeeper to an owner route', () => {
    expect(workspaceForRole('shopkeeper')).toBe('/pos')
  })
})
