Parse.Cloud.define('hello', async request => {
  return 'Hello from AncientFlip Parse Server!';
});

// Add your cloud functions here

Parse.Cloud.define('getUserByEmail', async request => {
  const { email } = request.params;

  if (!email) {
    throw new Error('Email parameter is required');
  }

  const query = new Parse.Query(Parse.User);
  query.equalTo('email', email);

  // Check if the requesting user is authenticated
  if (!request.user) {
    throw new Error('You must be logged in to perform this operation');
  }

  // Allow the query if:
  // 1. The user is querying their own email
  // 2. The user has admin role
  const isAdmin = await request.user.get('roles')?.includes('admin');
  const isOwnEmail = request.user.get('email') === email;

  if (!isAdmin && !isOwnEmail) {
    throw new Error('You do not have permission to query this email');
  }

  const user = await query.first({ useMasterKey: true });
  if (!user) {
    throw new Error('User not found');
  }

  // Return only necessary user information
  return {
    objectId: user.id,
    email: user.get('email'),
    username: user.get('username'),
  };
});

Parse.Cloud.define('resetUserPassword', async request => {
  const { username, newPassword } = request.params;

  try {
    // Query for the user
    const query = new Parse.Query(Parse.User);
    query.equalTo('username', username);
    const user = await query.first({ useMasterKey: true });

    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Set new password (this will properly hash it)
    user.setPassword(newPassword);
    await user.save(null, { useMasterKey: true });

    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

Parse.Cloud.define('resetPassword', async request => {
  const { username, email, phone_number, newPassword } = request.params;

  if (!newPassword) {
    throw new Parse.Error(141, 'New password is required');
  }

  // At least one identifier is required
  if (!username && !email && !phone_number) {
    throw new Parse.Error(141, 'Username, email, or phone number is required');
  }

  // Find the user by the provided identifier
  const query = new Parse.Query(Parse.User);

  if (username) {
    query.equalTo('username', username);
  } else if (email) {
    query.equalTo('email', email);
  } else if (phone_number) {
    query.equalTo('phone_number', phone_number);
  }

  try {
    const user = await query.first({ useMasterKey: true });

    if (!user) {
      throw new Parse.Error(101, 'User not found');
    }

    // Set the new password
    user.setPassword(newPassword);

    // Save the user with master key to bypass security
    await user.save(null, { useMasterKey: true });

    return {
      success: true,
      message: 'Password has been reset successfully',
    };
  } catch (error) {
    throw new Parse.Error(
      error.code || 500,
      error.message || 'An error occurred while resetting the password'
    );
  }
});

// For migrating users from old server to new server
Parse.Cloud.define('migrateUser', async request => {
  const { username, email, phone_number, oldPassword, newPassword } = request.params;

  // At least one identifier is required
  if (!username && !email && !phone_number) {
    throw new Parse.Error(141, 'Username, email, or phone number is required');
  }

  if (!newPassword) {
    throw new Parse.Error(141, 'New password is required');
  }

  // Find the user by the provided identifier
  const query = new Parse.Query(Parse.User);

  if (username) {
    query.equalTo('username', username);
  } else if (email) {
    query.equalTo('email', email);
  } else if (phone_number) {
    query.equalTo('phone_number', phone_number);
  }

  try {
    const user = await query.first({ useMasterKey: true });

    if (!user) {
      throw new Parse.Error(101, 'User not found');
    }

    // Set the new password and update user status if needed
    user.setPassword(newPassword);

    // Add any additional migration logic here
    // For example, updating user metadata about the migration
    user.set('passwordMigrated', true);

    // Save the user with master key to bypass security
    await user.save(null, { useMasterKey: true });

    return {
      success: true,
      message: 'User migrated successfully with new password',
    };
  } catch (error) {
    throw new Parse.Error(
      error.code || 500,
      error.message || 'An error occurred during user migration'
    );
  }
});
