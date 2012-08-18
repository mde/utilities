/*
 * Utilities: A classic collection of JavaScript utilities
 * Copyright 2112 Matthew Eernisse (mde@fleegix.org)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
*/

var fs = require('fs')
  , path = require('path')
  , JS_PAT = /\.js$/
  , logger;

var logger = new (function () {
  var out;
  try {
    out = require('./logger');
  }
  catch (e) {
    out = console;
  }

  this.log = function (o) {
    out.log(o);
  };
})();

var fileUtils = new (function () {
  var _copyFile = function(fromPath, toPath, opts) {
        var from = path.normalize(fromPath)
          , to = path.normalize(toPath)
          , options = opts || {}
          , fromStat
          , toStat
          , destExists
          , destDoesNotExistErr
          , content
          , filename
          , dirContents
          , targetDir;

        fromStat = fs.statSync(from);

        try {
          //console.dir(to + ' destExists');
          toStat = fs.statSync(to);
          destExists = true;
        }
        catch(e) {
          //console.dir(to + ' does not exist');
          destDoesNotExistErr = e;
          destExists = false;
        }
        // Destination dir or file exists, copy into (directory)
        // or overwrite (file)
        if (destExists) {

          // If there's a rename-via-copy file/dir name passed, use it.
          // Otherwise use the actual file/dir name
          filename = options.rename || path.basename(from);

          // Copying a directory
          if (fromStat.isDirectory()) {
            dirContents = fs.readdirSync(from);
            targetDir = path.join(to, filename);
            // We don't care if the target dir already exists
            try {
              fs.mkdirSync(targetDir, options.mode || 0755);
            }
            catch(e) {
              if (e.code != 'EEXIST') {
                throw e;
              }
            }
            for (var i = 0, ii = dirContents.length; i < ii; i++) {
              //console.log(dirContents[i]);
              _copyFile(path.join(from, dirContents[i]), targetDir);
            }
          }
          // Copying a file
          else {
            content = fs.readFileSync(from);
            // Copy into dir
            if (toStat.isDirectory()) {
              //console.log('copy into dir ' + to);
              fs.writeFileSync(path.join(to, filename), content);
            }
            // Overwrite file
            else {
              //console.log('overwriting ' + to);
              fs.writeFileSync(to, content);
            }
          }
        }
        // Dest doesn't exist, can't create it
        else {
          throw destDoesNotExistErr;
        }
      }

    , _copyDir = function (from, to, opts) {
        var createDir = opts.createDir;
      }

    , _readDir = function (dirPath) {
        var dir = path.normalize(dirPath)
          , paths = []
          , ret = [dir];

        try {
          paths = fs.readdirSync(dir);
        }
        catch (e) {
          throw new Error('Could not read path ' + dir);
        }

        paths.forEach(function (p) {
          var curr = path.join(dir, p);
          var stat = fs.statSync(curr);
          if (stat.isDirectory()) {
            ret = ret.concat(_readDir(curr));
          }
          else {
            ret.push(curr);
          }
        });

        return ret;
      }

    , _rmDir = function (dirPath) {
        var dir = path.normalize(dirPath)
          , paths = [];
        paths = fs.readdirSync(dir);
        paths.forEach(function (p) {
          var curr = path.join(dir, p);
          var stat = fs.statSync(curr);
          if (stat.isDirectory()) {
            _rmDir(curr);
          }
          else {
            fs.unlinkSync(curr);
          }
        });
        fs.rmdirSync(dir);
      }

    // Recursively watch files with a callback
    , _watch = function (path, callback) {
        fs.stat(path, function (err, stats) {
          if (err) {
            return false;
          }
          if (stats.isFile() && JS_PAT.test(path)) {
            fs.watchFile(path, callback);
          }
          else if (stats.isDirectory()) {
            fs.readdir(path, function (err, files) {
              if (err) {
                return log.fatal(err);
              }
              for (var f in files) {
                _watch(path + '/' + files[f], callback);
              }
            });
          }
        });
      };

  this.cpR = function (fromPath, toPath, options) {
    var from = path.normalize(fromPath)
      , to = path.normalize(toPath)
      , toStat
      , doesNotExistErr
      , paths
      , filename
      , opts = options || {};

    if (!opts.silent) {
      logger.log('cp -r ' + fromPath + ' ' + toPath);
    }

    opts = {}; // Reset

    if (from == to) {
      throw new Error('Cannot copy ' + from + ' to itself.');
    }

    // Handle rename-via-copy
    try {
      toStat = fs.statSync(to);
    }
    catch(e) {
      doesNotExistErr = e;

      // Get abs path so it's possible to check parent dir
      if (!this.isAbsolute(to)) {
        to = path.join(process.cwd() , to);
      }

      // Save the file/dir name
      filename = path.basename(to);
      // See if a parent dir exists, so there's a place to put the
      /// renamed file/dir (resets the destination for the copy)
      to = path.dirname(to);
      try {
        toStat = fs.statSync(to);
      }
      catch(e) {}
      if (toStat && toStat.isDirectory()) {
        // Set the rename opt to pass to the copy func, will be used
        // as the new file/dir name
        opts.rename = filename;
        //console.log('filename ' + filename);
      }
      else {
        throw doesNotExistErr;
      }
    }

    _copyFile(from, to, opts);
  };

  this.mkdirP = function (dir, mode) {
    var dirPath = path.normalize(dir)
      , paths = dirPath.split(/\/|\\/)
      , currPath
      , next;

    if (paths[0] == '' || /^[A-Za-z]+:/.test(paths[0])) {
      currPath = paths.shift() || '/';
      currPath = path.join(currPath, paths.shift());
      //console.log('basedir');
    }
    while ((next = paths.shift())) {
      if (next == '..') {
        currPath = path.join(currPath, next);
        continue;
      }
      currPath = path.join(currPath, next);
      try {
        //console.log('making ' + currPath);
        fs.mkdirSync(currPath, mode || 0755);
      }
      catch(e) {
        if (e.code != 'EEXIST') {
          throw e;
        }
      }
    }
  };

  this.readdirR = function (dir, opts) {
    var options = opts || {}
      , format = options.format || 'array'
      , ret;
    ret = _readDir(dir);
    return format == 'string' ? ret.join('\n') : ret;
  };

  this.rmRf = function (p, options) {
    var stat
      , opts = options || {};
    if (!opts.silent) {
      logger.log('rm -rf ' + p);
    }
    try {
      stat = fs.statSync(p);
      if (stat.isDirectory()) {
        _rmDir(p);
      }
      else {
        fs.unlinkSync(p);
      }
    }
    catch (e) {}
  };

  this.isAbsolute = function (p) {
    var match = /^[A-Za-z]+:\\|^\//.exec(p);
    if (match && match.length) {
      return match[0];
    }
    return false;
  };

  this.absolutize = function (p) {
    if (this.isAbsolute(p)) {
      return p;
    }
    else {
      return path.join(process.cwd(), p);
    }
  };

  this.basedir = function (p) {
    p = p || '';

    var basedir = ''
      , parts = p.split(/\\|\//)
      , part
      , pos = 0;
    for (var i = 0, l = parts.length - 1; i < l; i++) {
      part = parts[i];
      if (part.indexOf('*') !== -1) break;
      pos += part.length + 1;
      basedir += part + p[pos - 1];
    }
    if (!basedir) basedir = './';
    return basedir;
  };

  // Search for a directory in parent directories if it can't be found in cwd
  this.searchParentPath = function(location, callback) {
    var cwd = process.cwd();

    if(!location) {
      // Return if no path is given
      return;
    }
    var relPath = ''
      , i = 5 // Only search up to 5 directories
      , pathLoc
      , pathExists;

    while(--i >= 0) {
      pathLoc = path.join(cwd, relPath, location);
      pathExists = this.existsSync(pathLoc);

      if(pathExists) {
        callback && callback(undefined, pathLoc);
        break;
      } else {
        // Dir could not be found
        if(i === 0) {
          callback && callback(new Error("Path \"" + pathLoc + "\" not found"), undefined);
          break;
        }

        // Add a relative parent directory
        relPath += '../';
        // Switch to relative parent directory
        process.chdir(path.join(cwd, relPath));
      }
    }
  };

  this.watch = function () {
    _watch.apply(this, arguments);
  };

  // Compatibility for fs.exists(0.8) and path.exists(0.6)
  this.exists = (typeof fs.exists === 'function') ? fs.exists : path.exists;

  // Compatibility for fs.existsSync(0.8) and path.existsSync(0.6)
  this.existsSync = (typeof fs.existsSync === 'function') ? fs.existsSync : path.existsSync;

  // Require a module locally, i.e., in the node_modules directory
  // in the current directory
  this.requireLocal = function(module, message) {
    // Try to require in the application directory
    try {
      dep = require(path.join(process.cwd(), 'node_modules', module));
    }
    catch(err) {
      if(message) {
        throw new Error(message);
      }
      throw new Error('Module "' + module + '" could not be found as a ' +
          'local module.\n Please make sure there is a node_modules directory in the ' +
          'current directory,\n and install it by doing "npm install ' +
          module + '"');
    }
    return dep;
  };

})();

module.exports = fileUtils;

