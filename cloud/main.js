// Cloud code for AncientFlip Parse Server

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
