// cloud/main.js

// Global beforeSave for ALL classes to ensure consistent ACLs
Parse.Cloud.beforeSave(async request => {
  // Only set ACL for new objects that don't already have one
  if (request.object.isNew() && !request.object.getACL()) {
    const acl = new Parse.ACL();
    acl.setPublicReadAccess(true);
    acl.setPublicWriteAccess(true);
    request.object.setACL(acl);

    console.log(`Set public ACL for new ${request.object.className}`);
  }
});

// Optional: Cloud function to fix existing objects
Parse.Cloud.define('fixAllACLs', async request => {
  if (!request.master) {
    throw new Error('This function requires master key');
  }

  // Get all class names from your liveQuery config
  const classNames = [
    '_User',
    'LiveStreamingModel',
    'UserModel',
    'AudioChatUsersModel',
    'LiveViewersModel',
    'GiftsSenderModel',
    'LiveMessagesModel',
    'MessageModel',
    'MessageListModel',
    'GiftsModel',
    'GiftsSenderGlobalModel',
    'LeadersModel',
    'StoriesModel',
    'StoriesAuthorsModel',
    'PostsModel',
    'ObtainedItemsModel',
  ];

  let totalUpdated = 0;

  for (const className of classNames) {
    try {
      const query = new Parse.Query(className);
      query.limit(1000);
      const objects = await query.find({ useMasterKey: true });

      const promises = objects.map(async obj => {
        const acl = new Parse.ACL();
        acl.setPublicReadAccess(true);
        acl.setPublicWriteAccess(true);
        obj.setACL(acl);
        return obj.save(null, { useMasterKey: true });
      });

      await Promise.all(promises);
      totalUpdated += objects.length;
      console.log(`Updated ${objects.length} ${className} objects`);
    } catch (error) {
      console.error(`Error updating ${className}:`, error);
    }
  }

  return `Successfully updated ACLs for ${totalUpdated} total objects`;
});

// Optional: More restrictive version for Users only - only authenticated users can see other users
// Uncomment this and comment out the global beforeSave above if you want more privacy for users
/*
  Parse.Cloud.beforeSave(Parse.User, (request) => {
    if (request.object.isNew()) {
      console.log('Setting ACL for new user:', request.object.get('username'));
      
      const acl = new Parse.ACL();
      // Only authenticated users can read other users
      acl.setRoleReadAccess('*', true); // This means authenticated users
      acl.setWriteAccess(request.object.id, true);
      
      request.object.setACL(acl);
    }
  });
  */
