# Invitation System

The `@djpanda/convex-tenants` library provides a flexible invitation system that supports various identifier types (email, phone, username, etc.) and custom validation logic.

## Overview

Invitations use two key fields:
- **`inviteeIdentifier`**: The identifier used to invite someone (e.g., email address, phone number, username)
- **`identifierType`**: Optional string describing the type (e.g., "email", "phone", "username")

## Validation Callbacks

You can control invitation behavior through two optional callbacks in `makeTenantsAPI`:

### 1. `validateInvitationCreate`

Called when an invitation is created. Use this to:
- Validate identifier format
- Enforce domain whitelists
- Check rate limits
- Verify subscription limits
- Implement custom business logic

**Signature:**
```typescript
validateInvitationCreate?: (
  ctx: RunQueryCtx | RunMutationCtx,
  data: {
    organizationId: Id<"organizations">;
    inviteeIdentifier: string;
    identifierType?: string;
    inviterUserId: string;
    role: string;
  }
) => Promise<{ allowed: boolean; reason?: string }>;
```

### 2. `validateInvitationAccept`

Called when someone tries to accept an invitation. Use this to:
- Match invitation identifier with user identifier
- Allow flexible matching (e.g., same domain)
- Verify user credentials
- Implement custom acceptance logic

**Signature:**
```typescript
validateInvitationAccept?: (
  ctx: RunQueryCtx | RunMutationCtx,
  data: {
    invitation: {
      _id: Id<"invitations">;
      inviteeIdentifier: string;
      identifierType?: string;
      organizationId: Id<"organizations">;
      role: string;
    };
    acceptingUserId: string;
    acceptingUserIdentifier: string;
  }
) => Promise<{ allowed: boolean; reason?: string }>;
```

## Examples

### Example 1: Email-Only with Domain Whitelist

```typescript
export const tenants = makeTenantsAPI(components.tenants, {
  // ... other options
  
  validateInvitationCreate: async (ctx, data) => {
    const { inviteeIdentifier, identifierType, organizationId } = data;
    
    // Only allow email invitations
    if (identifierType !== "email" || !inviteeIdentifier.includes('@')) {
      return {
        allowed: false,
        reason: "Only email invitations are allowed"
      };
    }
    
    // Optional: Domain whitelist
    const org = await ctx.db.get(organizationId);
    const allowedDomains = org.metadata?.allowedDomains as string[] | undefined;
    
    if (allowedDomains && allowedDomains.length > 0) {
      const domain = inviteeIdentifier.split('@')[1]?.toLowerCase();
      
      if (!allowedDomains.includes(domain)) {
        return {
          allowed: false,
          reason: `Only emails from ${allowedDomains.join(', ')} can be invited`
        };
      }
    }
    
    return { allowed: true };
  },
  
  validateInvitationAccept: async (ctx, data) => {
    const { invitation, acceptingUserIdentifier } = data;
    
    // Exact match
    if (invitation.inviteeIdentifier.toLowerCase() === acceptingUserIdentifier.toLowerCase()) {
      return { allowed: true };
    }
    
    // Same domain allowed
    const invitedDomain = invitation.inviteeIdentifier.split('@')[1]?.toLowerCase();
    const userDomain = acceptingUserIdentifier.split('@')[1]?.toLowerCase();
    
    if (invitedDomain && userDomain && invitedDomain === userDomain) {
      return { allowed: true };
    }
    
    return {
      allowed: false,
      reason: "Invitation email doesn't match your account"
    };
  },
});
```

### Example 2: Open Collaboration (No Validation)

```typescript
export const tenants = makeTenantsAPI(components.tenants, {
  // ... other options
  // Don't provide validation callbacks - anyone with link can accept
});
```

### Example 3: Multi-Identifier Support

```typescript
export const tenants = makeTenantsAPI(components.tenants, {
  // ... other options
  
  validateInvitationCreate: async (ctx, data) => {
    const { inviteeIdentifier, identifierType } = data;
    
    // Validate based on type
    if (identifierType === "email") {
      if (!inviteeIdentifier.includes('@')) {
        return { allowed: false, reason: "Invalid email format" };
      }
    } else if (identifierType === "phone") {
      if (!/^\+\d{10,15}$/.test(inviteeIdentifier)) {
        return { allowed: false, reason: "Invalid phone format. Use E.164 format" };
      }
    } else if (identifierType === "username") {
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(inviteeIdentifier)) {
        return { allowed: false, reason: "Invalid username format" };
      }
    }
    
    return { allowed: true };
  },
  
  validateInvitationAccept: async (ctx, data) => {
    const { invitation, acceptingUserId } = data;
    
    // Get user's verified identifiers
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", acceptingUserId))
      .first();
    
    const verifiedIdentifiers = [
      user?.email,
      user?.phoneNumber,
      user?.username,
      ...(user?.secondaryEmails || []),
    ].filter(Boolean);
    
    if (verifiedIdentifiers.includes(invitation.inviteeIdentifier)) {
      return { allowed: true };
    }
    
    return {
      allowed: false,
      reason: "You need to verify this identifier first"
    };
  },
});
```

### Example 4: Rate Limiting

```typescript
export const tenants = makeTenantsAPI(components.tenants, {
  // ... other options
  
  validateInvitationCreate: async (ctx, data) => {
    const { organizationId } = data;
    
    // Check invitation rate (max 10 per hour per org)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentInvites = await ctx.db
      .query("invitations")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .filter((q) => q.gt(q.field("_creationTime"), oneHourAgo))
      .collect();
    
    if (recentInvites.length >= 10) {
      return {
        allowed: false,
        reason: "Rate limit exceeded. Maximum 10 invitations per hour."
      };
    }
    
    return { allowed: true };
  },
});
```

### Example 5: Domain-Based Auto-Join (Replaces Old `joinByDomain`)

To replicate the old domain-based auto-join functionality, create a custom mutation that automatically creates and accepts invitations for users with matching domains:

```typescript
import { mutation } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Custom mutation to replicate old "joinByDomain" functionality.
 * Allows users to auto-join orgs if their email domain matches.
 */
export const joinOrganizationByDomain = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const user = await ctx.db.get(userId);
    const userEmail = user?.email;
    if (!userEmail) throw new Error("User email not found");
    
    const userDomain = userEmail.split('@')[1]?.toLowerCase();
    if (!userDomain) throw new Error("Invalid email format");
    
    // Get organization
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organization not found");
    
    // Check if user's domain is in allowed list
    const allowedDomains = (org.metadata?.allowedDomains || []) as string[];
    if (!allowedDomains.includes(userDomain)) {
      throw new Error(`Domain ${userDomain} is not allowed to auto-join this organization`);
    }
    
    // Check if already a member
    const existingMember = await ctx.db
      .query("members")
      .withIndex("by_organization_and_user", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId)
      )
      .first();
    
    if (existingMember) {
      throw new Error("Already a member of this organization");
    }
    
    // Auto-create and accept invitation
    const invitation = await ctx.runMutation(api.tenants.inviteMember, {
      organizationId: args.organizationId,
      inviteeIdentifier: userEmail,
      identifierType: "email",
      role: "member", // Default role for auto-join
    });
    
    // Auto-accept the invitation
    await ctx.runMutation(api.tenants.acceptInvitation, {
      invitationId: invitation.invitationId,
    });
    
    return { success: true, organizationId: args.organizationId };
  },
});

/**
 * Query to list organizations the current user can auto-join by domain.
 */
export const listJoinableOrganizations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    
    const user = await ctx.db.get(userId);
    const userEmail = user?.email;
    if (!userEmail) return [];
    
    const userDomain = userEmail.split('@')[1]?.toLowerCase();
    if (!userDomain) return [];
    
    // Get all organizations with this domain in allowedDomains
    const allOrgs = await ctx.db.query("organizations").collect();
    
    const joinable = [];
    for (const org of allOrgs) {
      const allowedDomains = (org.metadata?.allowedDomains || []) as string[];
      
      if (allowedDomains.includes(userDomain)) {
        // Check if already a member
        const isMember = await ctx.db
          .query("members")
          .withIndex("by_organization_and_user", (q) =>
            q.eq("organizationId", org._id).eq("userId", userId)
          )
          .first();
        
        if (!isMember) {
          joinable.push({
            _id: org._id,
            name: org.name,
            slug: org.slug,
            logo: org.logo,
          });
        }
      }
    }
    
    return joinable;
  },
});
```

**Usage in React:**

```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

function JoinByDomainSection() {
  const joinableOrgs = useQuery(api.myFile.listJoinableOrganizations);
  const joinOrg = useMutation(api.myFile.joinOrganizationByDomain);
  
  if (!joinableOrgs?.length) return null;
  
  return (
    <div>
      <h3>Organizations You Can Join</h3>
      {joinableOrgs.map((org) => (
        <div key={org._id}>
          <span>{org.name}</span>
          <button onClick={() => joinOrg({ organizationId: org._id })}>
            Join
          </button>
        </div>
      ))}
    </div>
  );
}
```

**How it works:**
1. Store allowed domains in `org.metadata.allowedDomains: string[]`
2. Users with matching email domains can see joinable orgs
3. Clicking "Join" auto-creates and accepts an invitation
4. No manual invitation needed from org admins

### Example 6: Subscription-Based Limits

```typescript
export const tenants = makeTenantsAPI(components.tenants, {
  // ... other options
  
  validateInvitationCreate: async (ctx, data) => {
    const { organizationId } = data;
    
    // Check organization member limit from subscription
    const org = await ctx.db.get(organizationId);
    const subscription = org.metadata?.subscription as any;
    const memberLimit = subscription?.maxMembers || 10;
    
    const currentMembers = await ctx.db
      .query("members")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    
    if (currentMembers.length >= memberLimit) {
      return {
        allowed: false,
        reason: `Organization has reached member limit (${memberLimit}). Please upgrade.`
      };
    }
    
    return { allowed: true };
  },
});
```

## Using in React Components

The React components automatically support flexible identifiers:

```tsx
import { InviteMemberDialog } from "@djpanda/convex-tenants/react";

function MyComponent() {
  const { inviteMember } = useInvitations(/* ... */);
  
  return (
    <InviteMemberDialog
      organizationName="Acme Inc"
      onInvite={inviteMember}
      identifierType="email"                    // Optional: "email", "phone", etc.
      identifierLabel="Email Address"           // Optional: custom label
      identifierPlaceholder="user@example.com"  // Optional: custom placeholder
    />
  );
}
```

## More Patterns

You can combine and customize these examples based on your specific requirements. The validation callbacks give you complete control over who can create and accept invitations.

## Migration

If you're upgrading from an older version, see the [Migration Guide](../MIGRATION_GUIDE.md) for breaking changes and upgrade instructions.
