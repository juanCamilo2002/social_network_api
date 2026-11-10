module.exports = function renameLocalRequire() {
  return {
    visitor: {
      Program(path) {
        if (path.scope.hasOwnBinding('require')) {
          const name = path.scope.generateUidIdentifier('localRequire').name;

          path.scope.rename('require', name);
        }
      },
    },
  };
};