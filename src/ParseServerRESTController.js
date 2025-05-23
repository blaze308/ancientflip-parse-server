const Config = require('./Config');
const Auth = require('./Auth');
import RESTController from 'parse/lib/node/RESTController';
const Parse = require('parse/node');

function getSessionToken(options) {
  if (options && typeof options.sessionToken === 'string') {
    return Promise.resolve(options.sessionToken);
  }
  return Promise.resolve(null);
}

function getAuth(options = {}, config) {
  const installationId = options.installationId || 'cloud';
  if (options.useMasterKey) {
    return Promise.resolve(new Auth.Auth({ config, isMaster: true, installationId }));
  }
  return getSessionToken(options).then(sessionToken => {
    if (sessionToken) {
      options.sessionToken = sessionToken;
      return Auth.getAuthForSessionToken({
        config,
        sessionToken: sessionToken,
        installationId,
      });
    } else {
      return Promise.resolve(new Auth.Auth({ config, installationId }));
    }
  });
}

function ParseServerRESTController(applicationId, router) {
  function handleRequest(method, path, data = {}, options = {}, config) {
    // Store the arguments, for later use if internal fails
    const args = arguments;

    if (!config) {
      config = Config.get(applicationId);
    }
    const serverURL = new URL(config.serverURL);
    if (path.indexOf(serverURL.pathname) === 0) {
      path = path.slice(serverURL.pathname.length, path.length);
    }

    if (path[0] !== '/') {
      path = '/' + path;
    }

    if (path === '/batch') {
      const batch = transactionRetries => {
        let initialPromise = Promise.resolve();
        if (data.transaction === true) {
          initialPromise = config.database.createTransactionalSession();
        }
        return initialPromise.then(() => {
          const promises = data.requests.map(request => {
            return handleRequest(request.method, request.path, request.body, options, config).then(
              response => {
                if (options.returnStatus) {
                  const status = response._status;
                  const headers = response._headers;
                  delete response._status;
                  delete response._headers;
                  return { success: response, _status: status, _headers: headers };
                }
                return { success: response };
              },
              error => {
                return {
                  error: { code: error.code, error: error.message },
                };
              }
            );
          });
          return Promise.all(promises)
            .then(result => {
              if (data.transaction === true) {
                if (result.find(resultItem => typeof resultItem.error === 'object')) {
                  return config.database.abortTransactionalSession().then(() => {
                    return Promise.reject(result);
                  });
                } else {
                  return config.database.commitTransactionalSession().then(() => {
                    return result;
                  });
                }
              } else {
                return result;
              }
            })
            .catch(error => {
              if (
                error &&
                error.find(
                  errorItem => typeof errorItem.error === 'object' && errorItem.error.code === 251
                ) &&
                transactionRetries > 0
              ) {
                return batch(transactionRetries - 1);
              }
              throw error;
            });
        });
      };
      return batch(5);
    }

    let query;
    if (method === 'GET') {
      query = data;
    }

    return new Promise((resolve, reject) => {
      getAuth(options, config).then(auth => {
        const request = {
          body: data,
          config,
          auth,
          info: {
            applicationId: applicationId,
            sessionToken: options.sessionToken,
            installationId: options.installationId,
            context: options.context || {},
          },
          query,
        };
        return Promise.resolve()
          .then(() => {
            return router.tryRouteRequest(method, path, request);
          })
          .then(
            resp => {
              const { response, status, headers = {} } = resp;
              if (options.returnStatus) {
                resolve({ ...response, _status: status, _headers: headers });
              } else {
                resolve(response);
              }
            },
            err => {
              if (
                err instanceof Parse.Error &&
                err.code == Parse.Error.INVALID_JSON &&
                err.message == `cannot route ${method} ${path}`
              ) {
                RESTController.request.apply(null, args).then(resolve, reject);
              } else {
                reject(err);
              }
            }
          );
      }, reject);
    });
  }

  return {
    request: handleRequest,
    ajax: RESTController.ajax,
    handleError: RESTController.handleError,
  };
}

export default ParseServerRESTController;
export { ParseServerRESTController };
