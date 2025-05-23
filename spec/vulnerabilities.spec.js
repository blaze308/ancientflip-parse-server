const request = require('../lib/request');

describe('Vulnerabilities', () => {
  describe('(GHSA-8xq9-g7ch-35hg) Custom object ID allows to acquire role privilege', () => {
    beforeAll(async () => {
      await reconfigureServer({ allowCustomObjectId: true });
      Parse.allowCustomObjectId = true;
    });

    afterAll(async () => {
      await reconfigureServer({ allowCustomObjectId: false });
      Parse.allowCustomObjectId = false;
    });

    it('denies user creation with poisoned object ID', async () => {
      await expectAsync(
        new Parse.User({ id: 'role:a', username: 'a', password: '123' }).save()
      ).toBeRejectedWith(new Parse.Error(Parse.Error.OPERATION_FORBIDDEN, 'Invalid object ID.'));
    });

    describe('existing sessions for users with poisoned object ID', () => {
      /** @type {Parse.User} */
      let poisonedUser;
      /** @type {Parse.User} */
      let innocentUser;

      beforeAll(async () => {
        const parseServer = await global.reconfigureServer();
        const databaseController = parseServer.config.databaseController;
        [poisonedUser, innocentUser] = await Promise.all(
          ['role:abc', 'abc'].map(async id => {
            // Create the users directly on the db to bypass the user creation check
            await databaseController.create('_User', { objectId: id });
            // Use the master key to create a session for them to bypass the session check
            return Parse.User.loginAs(id);
          })
        );
      });

      it('refuses session token of user with poisoned object ID', async () => {
        await expectAsync(
          new Parse.Query(Parse.User).find({ sessionToken: poisonedUser.getSessionToken() })
        ).toBeRejectedWith(new Parse.Error(Parse.Error.INTERNAL_SERVER_ERROR, 'Invalid object ID.'));
        await new Parse.Query(Parse.User).find({ sessionToken: innocentUser.getSessionToken() });
      });
    });
  });

  describe('Object prototype pollution', () => {
    it('denies object prototype to be polluted with keyword "constructor"', async () => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': 'test',
        'X-Parse-REST-API-Key': 'rest',
      };
      const response = await request({
        headers: headers,
        method: 'POST',
        url: 'http://localhost:8378/1/classes/PP',
        body: JSON.stringify({
          obj: {
            constructor: {
              prototype: {
                dummy: 0,
              },
            },
          },
        }),
      }).catch(e => e);
      expect(response.status).toBe(400);
      const text = JSON.parse(response.text);
      expect(text.code).toBe(Parse.Error.INVALID_KEY_NAME);
      expect(text.error).toBe('Prohibited keyword in request data: {"key":"constructor"}.');
      expect(Object.prototype.dummy).toBeUndefined();
    });

    it('denies object prototype to be polluted with keypath string "constructor"', async () => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': 'test',
        'X-Parse-REST-API-Key': 'rest',
      };
      const objResponse = await request({
        headers: headers,
        method: 'POST',
        url: 'http://localhost:8378/1/classes/PP',
        body: JSON.stringify({
          obj: {},
        }),
      }).catch(e => e);
      const pollResponse = await request({
        headers: headers,
        method: 'PUT',
        url: `http://localhost:8378/1/classes/PP/${objResponse.data.objectId}`,
        body: JSON.stringify({
          'obj.constructor.prototype.dummy': {
            __op: 'Increment',
            amount: 1,
          },
        }),
      }).catch(e => e);
      expect(Object.prototype.dummy).toBeUndefined();
      expect(pollResponse.status).toBe(400);
      const text = JSON.parse(pollResponse.text);
      expect(text.code).toBe(Parse.Error.INVALID_KEY_NAME);
      expect(text.error).toBe('Prohibited keyword in request data: {"key":"constructor"}.');
      expect(Object.prototype.dummy).toBeUndefined();
    });

    it('denies object prototype to be polluted with keyword "__proto__"', async () => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': 'test',
        'X-Parse-REST-API-Key': 'rest',
      };
      const response = await request({
        headers: headers,
        method: 'POST',
        url: 'http://localhost:8378/1/classes/PP',
        body: JSON.stringify({ 'obj.__proto__.dummy': 0 }),
      }).catch(e => e);
      expect(response.status).toBe(400);
      const text = JSON.parse(response.text);
      expect(text.code).toBe(Parse.Error.INVALID_KEY_NAME);
      expect(text.error).toBe('Prohibited keyword in request data: {"key":"__proto__"}.');
      expect(Object.prototype.dummy).toBeUndefined();
    });
  });

  describe('Request denylist', () => {
    it('denies BSON type code data in write request by default', async () => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': 'test',
        'X-Parse-REST-API-Key': 'rest',
      };
      const params = {
        headers: headers,
        method: 'POST',
        url: 'http://localhost:8378/1/classes/RCE',
        body: JSON.stringify({
          obj: {
            _bsontype: 'Code',
            code: 'delete Object.prototype.evalFunctions',
          },
        }),
      };
      const response = await request(params).catch(e => e);
      expect(response.status).toBe(400);
      const text = JSON.parse(response.text);
      expect(text.code).toBe(Parse.Error.INVALID_KEY_NAME);
      expect(text.error).toBe(
        'Prohibited keyword in request data: {"key":"_bsontype","value":"Code"}.'
      );
    });

    it('denies expanding existing object with polluted keys', async () => {
      const obj = await new Parse.Object('RCE', { a: { foo: [] } }).save();
      await reconfigureServer({
        requestKeywordDenylist: ['foo'],
      });
      obj.addUnique('a.foo', 'abc');
      await expectAsync(obj.save()).toBeRejectedWith(
        new Parse.Error(Parse.Error.INVALID_KEY_NAME, `Prohibited keyword in request data: "foo".`)
      );
    });

    it('denies creating a cloud trigger with polluted data', async () => {
      Parse.Cloud.beforeSave('TestObject', ({ object }) => {
        object.set('obj', {
          constructor: {
            prototype: {
              dummy: 0,
            },
          },
        });
      });
      await expectAsync(new Parse.Object('TestObject').save()).toBeRejectedWith(
        new Parse.Error(
          Parse.Error.INVALID_KEY_NAME,
          'Prohibited keyword in request data: {"key":"constructor"}.'
        )
      );
    });

    it('denies creating global config with polluted data', async () => {
      const headers = {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': 'test',
        'X-Parse-Master-Key': 'test',
      };
      const params = {
        method: 'PUT',
        url: 'http://localhost:8378/1/config',
        json: true,
        body: {
          params: {
            welcomeMesssage: 'Welcome to Parse',
            foo: { _bsontype: 'Code', code: 'shell' },
          },
        },
        headers,
      };
      const response = await request(params).catch(e => e);
      expect(response.status).toBe(400);
      const text = JSON.parse(response.text);
      expect(text.code).toBe(Parse.Error.INVALID_KEY_NAME);
      expect(text.error).toBe(
        'Prohibited keyword in request data: {"key":"_bsontype","value":"Code"}.'
      );
    });

    it('denies direct database write wih prohibited keys', async () => {
      const Config = require('../lib/Config');
      const config = Config.get(Parse.applicationId);
      const user = {
        objectId: '1234567890',
        username: 'hello',
        password: 'pass',
        _session_token: 'abc',
        foo: { _bsontype: 'Code', code: 'shell' },
      };
      await expectAsync(config.database.create('_User', user)).toBeRejectedWith(
        new Parse.Error(
          Parse.Error.INVALID_KEY_NAME,
          'Prohibited keyword in request data: {"key":"_bsontype","value":"Code"}.'
        )
      );
    });

    it('denies direct database update wih prohibited keys', async () => {
      const Config = require('../lib/Config');
      const config = Config.get(Parse.applicationId);
      const user = {
        objectId: '1234567890',
        username: 'hello',
        password: 'pass',
        _session_token: 'abc',
        foo: { _bsontype: 'Code', code: 'shell' },
      };
      await expectAsync(
        config.database.update('_User', { _id: user.objectId }, user)
      ).toBeRejectedWith(
        new Parse.Error(
          Parse.Error.INVALID_KEY_NAME,
          'Prohibited keyword in request data: {"key":"_bsontype","value":"Code"}.'
        )
      );
    });

    it_id('e8b5f1e1-8326-4c70-b5f4-1e8678dfff8d')(it)('denies creating a hook with polluted data', async () => {
      const express = require('express');
      const port = 34567;
      const hookServerURL = 'http://localhost:' + port;
      const app = express();
      app.use(express.json({ type: '*/*' }));
      const server = await new Promise(resolve => {
        const res = app.listen(port, undefined, () => resolve(res));
      });
      app.post('/BeforeSave', function (req, res) {
        const object = Parse.Object.fromJSON(req.body.object);
        object.set('hello', 'world');
        object.set('obj', {
          constructor: {
            prototype: {
              dummy: 0,
            },
          },
        });
        res.json({ success: object });
      });
      await Parse.Hooks.createTrigger('TestObject', 'beforeSave', hookServerURL + '/BeforeSave');
      await expectAsync(new Parse.Object('TestObject').save()).toBeRejectedWith(
        new Parse.Error(
          Parse.Error.INVALID_KEY_NAME,
          'Prohibited keyword in request data: {"key":"constructor"}.'
        )
      );
      await new Promise(resolve => server.close(resolve));
    });

    it('denies write request with custom denylist of key/value', async () => {
      await reconfigureServer({
        requestKeywordDenylist: [{ key: 'a[K]ey', value: 'aValue[123]*' }],
      });
      const headers = {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': 'test',
        'X-Parse-REST-API-Key': 'rest',
      };
      const params = {
        headers: headers,
        method: 'POST',
        url: 'http://localhost:8378/1/classes/RCE',
        body: JSON.stringify({
          obj: {
            aKey: 'aValue321',
            code: 'delete Object.prototype.evalFunctions',
          },
        }),
      };
      const response = await request(params).catch(e => e);
      expect(response.status).toBe(400);
      const text = JSON.parse(response.text);
      expect(text.code).toBe(Parse.Error.INVALID_KEY_NAME);
      expect(text.error).toBe(
        'Prohibited keyword in request data: {"key":"a[K]ey","value":"aValue[123]*"}.'
      );
    });

    it('denies write request with custom denylist of nested key/value', async () => {
      await reconfigureServer({
        requestKeywordDenylist: [{ key: 'a[K]ey', value: 'aValue[123]*' }],
      });
      const headers = {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': 'test',
        'X-Parse-REST-API-Key': 'rest',
      };
      const params = {
        headers: headers,
        method: 'POST',
        url: 'http://localhost:8378/1/classes/RCE',
        body: JSON.stringify({
          obj: {
            nested: {
              aKey: 'aValue321',
              code: 'delete Object.prototype.evalFunctions',
            },
          },
        }),
      };
      const response = await request(params).catch(e => e);
      expect(response.status).toBe(400);
      const text = JSON.parse(response.text);
      expect(text.code).toBe(Parse.Error.INVALID_KEY_NAME);
      expect(text.error).toBe(
        'Prohibited keyword in request data: {"key":"a[K]ey","value":"aValue[123]*"}.'
      );
    });

    it('denies write request with custom denylist of key/value in array', async () => {
      await reconfigureServer({
        requestKeywordDenylist: [{ key: 'a[K]ey', value: 'aValue[123]*' }],
      });
      const headers = {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': 'test',
        'X-Parse-REST-API-Key': 'rest',
      };
      const params = {
        headers: headers,
        method: 'POST',
        url: 'http://localhost:8378/1/classes/RCE',
        body: JSON.stringify({
          obj: [
            {
              aKey: 'aValue321',
              code: 'delete Object.prototype.evalFunctions',
            },
          ],
        }),
      };
      const response = await request(params).catch(e => e);
      expect(response.status).toBe(400);
      const text = JSON.parse(response.text);
      expect(text.code).toBe(Parse.Error.INVALID_KEY_NAME);
      expect(text.error).toBe(
        'Prohibited keyword in request data: {"key":"a[K]ey","value":"aValue[123]*"}.'
      );
    });

    it('denies write request with custom denylist of key', async () => {
      await reconfigureServer({
        requestKeywordDenylist: [{ key: 'a[K]ey' }],
      });
      const headers = {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': 'test',
        'X-Parse-REST-API-Key': 'rest',
      };
      const params = {
        headers: headers,
        method: 'POST',
        url: 'http://localhost:8378/1/classes/RCE',
        body: JSON.stringify({
          obj: {
            aKey: 'aValue321',
            code: 'delete Object.prototype.evalFunctions',
          },
        }),
      };
      const response = await request(params).catch(e => e);
      expect(response.status).toBe(400);
      const text = JSON.parse(response.text);
      expect(text.code).toBe(Parse.Error.INVALID_KEY_NAME);
      expect(text.error).toBe('Prohibited keyword in request data: {"key":"a[K]ey"}.');
    });

    it('denies write request with custom denylist of value', async () => {
      await reconfigureServer({
        requestKeywordDenylist: [{ value: 'aValue[123]*' }],
      });
      const headers = {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': 'test',
        'X-Parse-REST-API-Key': 'rest',
      };
      const params = {
        headers: headers,
        method: 'POST',
        url: 'http://localhost:8378/1/classes/RCE',
        body: JSON.stringify({
          obj: {
            aKey: 'aValue321',
            code: 'delete Object.prototype.evalFunctions',
          },
        }),
      };
      const response = await request(params).catch(e => e);
      expect(response.status).toBe(400);
      const text = JSON.parse(response.text);
      expect(text.code).toBe(Parse.Error.INVALID_KEY_NAME);
      expect(text.error).toBe('Prohibited keyword in request data: {"value":"aValue[123]*"}.');
    });

    it('denies BSON type code data in file metadata', async () => {
      const str = 'Hello World!';
      const data = [];
      for (let i = 0; i < str.length; i++) {
        data.push(str.charCodeAt(i));
      }
      const file = new Parse.File('hello.txt', data, 'text/plain');
      file.addMetadata('obj', {
        _bsontype: 'Code',
        code: 'delete Object.prototype.evalFunctions',
      });
      await expectAsync(file.save()).toBeRejectedWith(
        new Parse.Error(
          Parse.Error.INVALID_KEY_NAME,
          `Prohibited keyword in request data: {"key":"_bsontype","value":"Code"}.`
        )
      );
    });

    it('denies BSON type code data in file tags', async () => {
      const str = 'Hello World!';
      const data = [];
      for (let i = 0; i < str.length; i++) {
        data.push(str.charCodeAt(i));
      }
      const file = new Parse.File('hello.txt', data, 'text/plain');
      file.addTag('obj', {
        _bsontype: 'Code',
        code: 'delete Object.prototype.evalFunctions',
      });
      await expectAsync(file.save()).toBeRejectedWith(
        new Parse.Error(
          Parse.Error.INVALID_KEY_NAME,
          `Prohibited keyword in request data: {"key":"_bsontype","value":"Code"}.`
        )
      );
    });
  });

  describe('Ignore non-matches', () => {
    it('ignores write request that contains only fraction of denied keyword', async () => {
      await reconfigureServer({
        requestKeywordDenylist: [{ key: 'abc' }],
      });
      // Initially saving an object executes the keyword detection in RestWrite.js
      const obj = new TestObject({ a: { b: { c: 0 } } });
      await expectAsync(obj.save()).toBeResolved();
      // Modifying a nested key executes the keyword detection in DatabaseController.js
      obj.increment('a.b.c');
      await expectAsync(obj.save()).toBeResolved();
    });
  });
});

describe('Postgres regex sanitizater', () => {
  it('sanitizes the regex correctly to prevent Injection', async () => {
    const user = new Parse.User();
    user.set('username', 'username');
    user.set('password', 'password');
    user.set('email', 'email@example.com');
    await user.signUp();

    const response = await request({
      method: 'GET',
      url:
        "http://localhost:8378/1/classes/_User?where[username][$regex]=A'B'%3BSELECT+PG_SLEEP(3)%3B--",
      headers: {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': 'test',
        'X-Parse-REST-API-Key': 'rest',
      },
    });

    expect(response.status).toBe(200);
    expect(response.data.results).toEqual(jasmine.any(Array));
    expect(response.data.results.length).toBe(0);
  });
});
