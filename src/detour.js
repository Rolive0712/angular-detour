var   matchSvc = '$match'
      , abstractVar = 'abstract'
      , detourSvc = '$detour'
;

function $DetourProvider(
  $urlMatcherFactory
) {
  var that = this;

  function State() {
    this._children = {};
  }

  //*********************************************
  // initialize
  //*********************************************
  Object.defineProperty(State.prototype, 'self', {
    get: function() { return this; }
  });

  State.prototype.resetAll = function() {
    this.resetFullName();
    this.resetUrl();
    this.resetParams();
    this.resetNavigable();
    this.resetPath();
    this.resetViews();
    this.resetIncludes();
    this.resetHandlers();
  };

  State.prototype.initialize = function(forceInit) {
    if (this.needsInit || forceInit) {
      this.resetAll();

      for (var child in this.children) {
        this.children[child].initialize(true);
      }
      this.needsInit = false;
    }
  };

  //*********************************************
  // name/fullName/localName
  //*********************************************
  Object.defineProperty(State.prototype, 'fullName', {
    get: function() { return this._fullName; }
  });
  Object.defineProperty(State.prototype, 'name', {
    get: function() { return this._fullName; }
  });
  Object.defineProperty(State.prototype, 'localName', {
    get: function() { return this._localName; },
    set: function(val) {
      this.validateName(val);
      this._localName= val;
      this.needsInit = true;
    }
  });

  State.prototype.resetFullName = function() {
    this._fullName = (this.parent.fullName)
      ? this.parent.fullName + '.' + this.localName
      : this.localName;
  };
  State.prototype.toString = function() { return this.fullName; };

  State.prototype.validateName = function(localName) {
    if (!angular.isString(localName) || localName.indexOf('@') >= 0) {
      throw new Error('Invalid local state name (' + localName + ')');
    }

    // can't redefine if we throw this error here
    //not really useful, anyway
    // if (this.parent && this.parent.getChild(localName)) {
    //     throw new Error('State ' + parent.fullName  + ' already has child ' + localName);
    // }
  };

  //*********************************************
  // root
  //*********************************************
  Object.defineProperty(State.prototype, 'root', {
    get: function() { return this.parent.root; }
  });

  //*********************************************
  // children
  //*********************************************
  Object.defineProperty(State.prototype, 'children', {
    get: function() { return this._children; },
    set: function(val) {
      this._children = val;
      if (this._children) {
        for (var child in this._children) {
          //assigning their parent takes care of resetting the children
          this._children[child].parent = this;
        }
      }
    }
  });

  //*********************************************
  // path
  //*********************************************
  State.prototype.resetPath = function() {
    // Keep a full path from the root down to this state as this is needed for state activation.
    this.path = this.parent.path.concat(this); // exclude root from path
  };

  //*********************************************
  // url
  //*********************************************
  Object.defineProperty(State.prototype, 'url', {
    get: function() { return this._url; },
    set: function(val) {
      this._url= val;
      this.needsInit = true;
    }
  });
  Object.defineProperty(State.prototype, 'aliases', {
    get: function() { return this._aliases; },
    set: function(val) {
      this._aliases= val;
      this.needsInit = true;
    }
  });
  State.prototype.resetUrl = function() {
    /*jshint eqeqeq:false */
    this.preparedUrl = null;
    if (angular.isString(this.url)) {
      if (this.url.charAt(0) === '^') {
        this.preparedUrl = $urlMatcherFactory.compile(this.url.substring(1));
      } else {
        this.preparedUrl = (this.parent.navigable || this.root).preparedUrl.concat(this.url);
      }
    } else if (isObject(this.url) &&
        isFunction(this.url.exec) && isFunction(this.url.format) && isFunction(this.url.concat)) {
          this.preparedUrl = this.url;
      /* use UrlMatcher (or compatible object) as is */
    } else if (this.url != null) {
      throw new Error('Invalid url ' + this.url + ' in state ' + this);
    }

  };

  //*********************************************
  // params
  //*********************************************
  Object.defineProperty(State.prototype, 'params', {
    get: function() { return this._params; },
    set: function(val) {
      this._params= val;
      this.needsInit = true;
    }
  });
  State.prototype.resetParams = function() {
    // Derive parameters for this state and ensure they're a super-set of parent's parameters
    this.preparedParams = null;

    // Derive parameters for this state and ensure they're a super-set of parent's parameters
    var params = this.params;
    if (params) {
      if (!isArray(params)) {
        throw new Error('Invalid params in state \'' + this + '\'');
      }
      else {
        if (this.preparedUrl) {
          throw new Error('Both params and url specicified in state \'' + this + '\'');
        }
        else {
          this.perparedParams = params;
        }
      }
    }
    else {
      this.preparedParams = this.preparedUrl ? this.preparedUrl.parameters() : this.parent.preparedParams;
    }

    var paramNames = {};
    forEach(this.preparedParams, function (p) {
      paramNames[p] = true;
    });
    if (this.parent) {
      var that = this;
      forEach(this.parent.preparedParams, function (p) {
        if (!paramNames[p]) {
          throw new Error('Missing required parameter \'' + p + '\' in state \'' + that.name + '\'');
        }
        paramNames[p] = false;
      });

      var ownParams = this.ownParams = [];
      forEach(paramNames, function (own, p) {
        if (own) {
          ownParams.push(p);
        }
      });
    } else {
      this.ownParams = this.preparedParams;
    }
  };

  //*********************************************
  // navigable
  //*********************************************
  State.prototype.resetNavigable = function() {
    this.navigable = (this.url)
      ? this
      : (this.parent)
        ? this.parent.navigable
        : null;
  };

  //*********************************************
  // abstract
  //*********************************************
  Object.defineProperty(State.prototype, abstractVar, {
    get: function() { return this._abstract; },
    set: function(val) {
      this._abstract= val;
      this.needsInit = true;
    }
  });

  //*********************************************
  // includes
  //*********************************************
  State.prototype.resetIncludes = function() {
    // Speed up $detour.contains() as it's used a lot
    this.includes = (this.parent)
      ? angular.extend({}, this.parent.includes)
      : {};
    this.includes[this.name] = true;
  };

  //*********************************************
  // views
  //*********************************************
  Object.defineProperty(State.prototype, 'views', {
    get: function() { return this._views; },
    set: function(val) {
      this._views= val;
      this.needsInit = true;
    }
  });
  State.prototype.resetViews = function() {
    var state = this;
    // If there is no explicit multi-view configuration, make one up so we don't have
    // to handle both cases in the view directive later. Note that having an explicit
    // 'views' property will mean the default unnamed view properties are ignored. This
    // is also a good time to resolve view names to absolute names, so everything is a
    // straight lookup at link time.
    var views = {};
    var myViews = this.views;
    angular.forEach(angular.isDefined(myViews) ? myViews : { '': state }, function (view, name) {
      if (name.indexOf('@') < 0) {
        name = name + '@' + state.parent.name;
      }
      views[name] = view;
    });
    this.preparedViews = views;
  };

  //*********************************************
  // handleUrl
  //*********************************************
  State.prototype._buildRule = function(what, handler) {
    var rule, redirect;
    if (isString(what)) {
      what = $urlMatcherFactory.compile(what);
    }

    if ($urlMatcherFactory.isMatcher(what)) {
      if (isString(handler)) {
        redirect = $urlMatcherFactory.compile(handler);
        handler = [matchSvc, function ($match) { return redirect.format($match); }];
      }
      else if (!isFunction(handler) && !isArray(handler)) {
        throw new Error('invalid \'handler\' in when()');
      }

      rule = function ($injector, $location) {
        return handleIfMatch($injector, handler, what.exec($location.path(), $location.search()));
      };
      rule.prefix = isString(what.prefix) ? what.prefix : '';
    }
    else if (what instanceof RegExp) {
      if (isString(handler)) {
        redirect = handler;
        handler = [matchSvc, function ($match) { return interpolate(redirect, $match); }];
      }
      else if (!isFunction(handler) && !isArray(handler)) {
        throw new Error('invalid \'handler\' in when()');
      }

      if (what.global || what.sticky) {
        throw new Error('when() RegExp must not be global or sticky');
      }

      rule = function ($injector, $location) {
        return handleIfMatch($injector, handler, what.exec($location.path()));
      };
      rule.prefix = regExpPrefix(what);
    }
    else {
      throw new Error('invalid \'what\' in when()');
    }
    return rule;
  };

  State.prototype.resetHandlers = function() {
    if (this[abstractVar] || !this.preparedUrl) {
      this.handleUrl = null;
      return;
    }

    var what = this.preparedUrl;
    var that = this;
    var handler = [matchSvc, detourSvc, function ($match, $detour) {
      $detour.transitionTo(that, $match, false);
    }];

    this.handleUrl = this._buildRule(what, handler);

    this.preparedAliases = [];
    if (this.aliases) {
      angular.forEach(this.aliases, function(value, key) {
        value = value.charAt(0) === '^'
          ? value.substring(1)
          : (that.parent.navigable || that.root).preparedUrl.concat(value).source;
        that.preparedAliases.push(that._buildRule(key, value));
      });
    }

  };

  State.prototype.tryHandle = function($injector, $location) {
    var handled = false;

    if (this.handleUrl) {
      handled = this.handleUrl($injector, $location);
      for (var i = 0; i < this.preparedAliases.length && !handled; i++) {
        handled = this.preparedAliases[i]($injector, $location);
      }
    }

    if (!handled) {
      for (var child in this.children) {
        handled = this.children[child].tryHandle($injector, $location);
        if (handled) {
          break;
        }
      }
    }

    return handled;
  };


  //*********************************************
  // getChild
  //*********************************************
  State.prototype.getChild = function(localName) {
    return (this.children)
      ? this.children[localName]
      : null;
  };


  //*********************************************
  // setChild
  //*********************************************
  //this redefines the child in place (i.e. doesn't wipe out its children)
  State.prototype.setChild = function(stateDef, deep) {
    var state = new State();
    angular.extend(state, stateDef);

    return this.setChildState(state, deep);
  };

  //*********************************************
  // removeChild
  //*********************************************
  //undefines the child (and any descendants of the child)
  State.prototype.removeChild = function(localName) {
    if (this.children[localName]) {
      delete this.children[localName];
    }
    //this._needsInit = true;
    return this;
  };


  //*********************************************
  // setChildState
  //*********************************************
  //this redefines the child in place (i.e. doesn't wipe out its children)
  State.prototype.setChildState = function(state, deep) {
    if (!deep) {
      var existingChild = this.getChild(state.localName);
      var existingChildren = (existingChild)
        ? existingChild.children
        : null;

      if (existingChildren) {
        state._children = existingChildren;
      }

    }

    this.children[state.localName] = state;
    state.parent = this;
    this.needsInit = true;
    return state;
  };


  //*********************************************
  // updateChild
  //*********************************************
  //this updates properties of the child in place (i.e. doesn't wipe out its children)
  //nor does it start with a fresh state, so properties not overwritten are maintained
  //however, if no existing state, a new one is created
  State.prototype.updateChild = function(stateDef) {
    var state = this.getChild(stateDef.localName);
    if (!state) {
      // deep doesn't really matter since this will be a new state, but
      // for form it's set to true
      return this.setChild(stateDef, true);
    }
    else {
      angular.extend(state, stateDef);

      return this.setChildState(state, false);
    }
  };

  //*********************************************
  // prepareFlatDefinition
  //*********************************************
  State.prototype.prepFlatGetParent = function(stateDef) {
    var parent, localName;
    if (stateDef.parent) {
      parent = this.getState(stateDef.parent);
      localName = stateDef.fullName;
    }
    else
    {
      var fullName = stateDef.fullName
        ? stateDef.fullName
        : stateDef.name;

      var parts = /^(.*?)\.?([^\.]*)$/.exec(fullName);

      var parentName = parts[1];
      localName = parts[2];

      parent = parentName
        ? this.getState(parentName)
        : this.root;
    }

    stateDef.localName = localName;

    delete stateDef.name;
    delete stateDef.fullName;
    delete stateDef.parent;

    return parent;
  };


  //*********************************************
  // setState
  //*********************************************
  //specify name/fullName in the definition to indicate
  //parent (which must already exist) -- for compatibility
  //with ui-router or other non-oo definition style
  State.prototype.setState = function(stateDef, deep) {
    var parent = this.prepFlatGetParent(stateDef);

    return parent.setChild(stateDef, deep);
  };

  //*********************************************
  // updateState
  //*********************************************
  //specify name/fullName in the definition to indicate
  //parent (which must already exist) -- for compatibility
  //with ui-router or other non-oo definition style
  State.prototype.updateState = function(stateDef) {
    var parent = this.prepFlatGetParent(stateDef);

    return parent.updateChild(stateDef);
  };

  //*********************************************
  // findState
  //*********************************************
  State.prototype.findState = function(partialName) {
    var parts = /^([^\.]+)(\.(.*))?$/.exec(partialName);
    var firstPart = parts[1];
    if (this.localName === firstPart)
    {
      //first part matches this node
      //grab the rest of the name
      var rest = parts[3];
      if (rest) {
        return this.findStateChildren(rest);
      }
      else {
        //there is no 'rest' -- we've found the state
        return this;
      }
    }
    else {
      //this is not a path for this partialName
      return null;
    }
  };

  //*********************************************
  // findStateChildren
  //*********************************************
  State.prototype.findStateChildren = function(partialName) {
    if (this.children) {
      for (var child in this.children) {
        var found = this.children[child].findState(partialName);
        if (found) {
          return found;
        }
      }
    }
    //nothing was found
    return null;
  };

  //*********************************************
  // getState
  //*********************************************
  State.prototype.getState = function(state) {
    if (!angular.isString(state)) {
      return this.root.findStateChildren(state.fullName);
    }
    else {
      return this.root.findStateChildren(state);
    }
  };

  //*********************************************
  // JSON support
  //*********************************************
  State.prototype.getIntJson = function(object, longPropertyName, shortPropertyName) {
    return object[shortPropertyName]
      ? parseInt(object[shortPropertyName], 10)
      : object[longPropertyName]
        ? parseInt(object[longPropertyName], 10)
        : null;
  };

  State.prototype.getObjJson = function(object, longPropertyName, shortPropertyName) {
    return object[shortPropertyName]
      ? object[shortPropertyName]
      : object[longPropertyName]
        ? object[longPropertyName]
        : null;
  };

  State.prototype.expandDefinition = function(definition) {
    this.expandJson(definition, 'url', 'u');
    this.expandJson(definition, 'dependencies', 'd');
    this.expandJson(definition, 'resolveByService', 'r');
    this.expandJson(definition, 'templateService', 'i');
    this.expandJson(definition, 'aliases', 's');
    this.expandJson(definition, 'controller', 'c');
    this.expandJson(definition, 'templateUrl', 't');
    this.expandJson(definition, 'template', 'l');
    this.expandJson(definition, 'data', 'a');
    this.expandJson(definition, 'abstract', 'b');
    this.expandJson(definition, 'views', 'v');
  };

  State.prototype.expandView = function(view) {
    this.expandJson(view, 'url', 'u');
    this.expandJson(view, 'resolveByService', 'r');
    this.expandJson(view, 'templateService', 'i');
    this.expandJson(view, 'controller', 'c');
    this.expandJson(view, 'templateUrl', 't');
    this.expandJson(view, 'template', 'l');
    this.expandJson(view, 'data', 'a');
  };

  State.prototype.expandJson = function(object, longPropertyName, shortPropertyName) {
    if (object[shortPropertyName]) {
      object[longPropertyName] = object[shortPropertyName];
      delete object[shortPropertyName];
    }
  };

  State.prototype.mergeChild = function(name, childJson) {
    //the name of the child we're working with
    var del = this.getObjJson(childJson, 'delete', 'x');
    if (del) {
      this.removeChild(name);
    }
    else
    {
      var definition = this.getObjJson(childJson, 'definition', 'd');
      if (definition) {
        //a definition is specified -- update child
        definition.localName = name;
        this.expandDefinition(definition);
        if (definition.views) {
          for (var viewName in definition.views) {
            var view = definition.views[viewName];
            this.expandView(view);
          }
        }

        this.updateChild(definition);
      }

      var children = this.getObjJson(childJson, 'children', 'c');
      if (children) {
        var thisChild = this.getChild(name);
        for (var grandchildName in children) {
          var grandChild = children[grandchildName];
          thisChild.mergeChild(grandchildName, grandChild);
        }
      }
    }

    return true;
  };

  Object.defineProperty(State.prototype, 'knownStates', {
    get: function() {
      var summary = {};

      if (Object.keys(this.children).length > 0) {
        var children = {};
        for (var childName in this.children) {
          var child = this.children[childName];
          children[child.localName] = child.knownStates;
        }
        summary = children;
      }

      return summary;
    }
  });


  //*********************************************
  //*********************************************
  // StatesTree
  //*********************************************
  //*********************************************
  function StatesTree() {
    this.locals = { globals: { $stateParams: {} } };
    this.serial = 0;
    this.resetAll();
  }

  StatesTree.prototype = new State();
  StatesTree.prototype.constructor = StatesTree;

  StatesTree.prototype.initialize = function() {
    //no need to initialize the root/tree itself
    for (var child in this.children) {
      //don't force initialization -- children
      //that need to initialize will do so
      //and will force deep initialization of their
      //own children
      this.children[child].initialize(false);
    }
    this.needsInit = false;
  };

  StatesTree.prototype.tryHandle = function($injector, $location, doFallback) {
    var that = this;
    var handled = State.prototype.tryHandle.call(that, $injector, $location);
    if (!handled && doFallback) {
      if (this.fallback) {
        handled = this.fallback($injector, $location);
      }
    }

    return handled;
  };

  Object.defineProperty(StatesTree.prototype, 'fallback', {
    get: function() { return this._fallback; },
    set: function(val) {
      if (isString(val)) {
        var redirect = val;
        if (redirect) {
          this._fallback = function () { return redirect; };
        }
        else {
          this._fallback = null;
        }
      }
      else if (!isFunction(rule)) {
        throw new Error('\'rule\' must be a function');
      }
    }
  });

  StatesTree.prototype.resetFullName = function() {};
  StatesTree.prototype.resetPath = function() {};

  Object.defineProperty(StatesTree.prototype, 'name', {
    get: function() { return ''; }
  });
  Object.defineProperty(StatesTree.prototype, 'localName', {
    get: function() { return ''; }
  });
  Object.defineProperty(StatesTree.prototype, 'url', {
    get: function() { return '^'; }
  });
  Object.defineProperty(StatesTree.prototype, 'views', {
    get: function() { return {}; }
  });
  Object.defineProperty(StatesTree.prototype, 'abstract', {
    get: function() { return true; }
  });
  Object.defineProperty(StatesTree.prototype, 'path', {
    get: function() { return []; }
  });
  Object.defineProperty(StatesTree.prototype, 'root', {
    get: function() { return this; }
  });
  Object.defineProperty(StatesTree.prototype, 'isRoot', {
    get: function() { return true; }
  });
  Object.defineProperty(StatesTree.prototype, 'fullName', {
    get: function() { return null; }
  });
  Object.defineProperty(StatesTree.prototype, 'navigable', {
    get: function() { return null; },
    set: function(val) {}
  });

  StatesTree.prototype.mergeJson = function(json) {
    var serial = this.getIntJson(json, 'serial', 's');

    if (serial && serial <= this.serial) {
      //this update is specifically old
      //if serial had been omitted we'd assume that it's not being used
      return false;
    }
    else {
      var tree = this.getObjJson(json, 'tree', 't');

      if (tree) {
        for (var childName in tree) {
          var child = tree[childName];
          this.mergeChild(childName, child);
        }
      }

      var fallback = this.getObjJson(json, 'fallback', 'f');
      if (fallback) {
        this.fallback = fallback;
      }

      this.serial = serial;

      this.initialize();

      return true;
    }
  };

  Object.defineProperty(StatesTree.prototype, 'knownStates', {
    get: function() {
      var summary = {
        s: this.serial,
        f: this.fallback
      };

      var tree = {};
      for (var childName in this.children) {
        var child = this.children[childName];
        tree[childName] = child.knownStates;
      }

      summary.t = tree;

      return summary;
    }
  });



//***************************************
//***************************************
//URLPROVIDER
//***************************************
//***************************************
  // Returns a string that is a prefix of all strings matching the RegExp
  function regExpPrefix(re) {
    var prefix = /^\^((?:\\[^a-zA-Z0-9]|[^\\\[\]\^$*+?.()|{}]+)*)/.exec(re.source);
    return (prefix !== null) ? prefix[1].replace(/\\(.)/g, '$1') : '';
  }

  // Interpolates matched values into a String.replace()-style pattern
  function interpolate(pattern, match) {
    return pattern.replace(/\$(\$|\d{1,2})/, function (m, what) {
      return match[what === '$' ? 0 : Number(what)];
    });
  }

  function handleIfMatch($injector, handler, match) {
    if (!match) {
      return false;
    }
    var result = $injector.invoke(handler, handler, { $match: match });
    return isDefined(result) ? result : true;
  }
//***************************************
//(end URLPROVIDER)
//***************************************

  //***************************************
  //set up the state tree
  //***************************************
  var statesTree = new StatesTree();

  //***************************************
  //provider api for ui-router stateProvider compatibility
  //***************************************
  function state(name, definition) {
    definition.fullName = name;
    statesTree.setState(definition);
    return this;
  }
  this.state = state;

  //***************************************
  //otherwise from urlRouterProvider
  //***************************************
  function otherwise(rule) {
    statesTree.fallback = rule;
    return this;
  }
  this.otherwise = otherwise;

  function initialize() {
    statesTree.initialize();
  }
  this.initialize = initialize;

  function removeState(fullName) {
    var state = this.getState(fullName);
    if (state) {
      state.parent.removeChild(state.localName);
    }
    return this;
  }
  this.removeState = removeState;

  function setState(stateDef) {
    return statesTree.setState(stateDef);
  }
  this.setState = setState;

  function updateState(stateDef) {
    return statesTree.updateState(stateDef);
  }
  this.updateState = updateState;

  function getState(state) {
    return statesTree.getState(state);
  }
  this.getState = getState;

  function mergeJson(json) {
    return statesTree.mergeJson(json);
  }
  this.mergeJson = mergeJson;

  this.lazy = false;

  //***************************************
  //service definition
  //***************************************
  function $get(   $rootScope,   $q,   $templateFactory,   $injector,   $stateParams,   $location, $couchPotato) {

    var TransitionSuperseded = $q.reject(new Error('transition superseded'));
    var TransitionPrevented = $q.reject(new Error('transition prevented'));

    var $detour = {
      params: {},
      current: statesTree.self,
      $current: statesTree,
      transition: null
    };

    var lazy = that.lazy;
    var stateLoader = null;

    $detour.setStateLoader = function(loader) {
      stateLoader = loader;
    };

    $detour.registerValue = $couchPotato.registerValue;
    $detour.registerFactory = $couchPotato.registerFactory;
    $detour.registerFilter = $couchPotato.registerFilter;
    $detour.registerDirective = $couchPotato.registerDirective;
    $detour.registerController = $couchPotato.registerController;


    $detour.state = state;
    $detour.otherwise = otherwise;
    $detour.initialize = initialize;
    $detour.setState = setState;
    $detour.updateState = updateState;
    $detour.getState = getState;
    $detour.removeState = removeState;

    $detour.mergeJson = mergeJson;

    //***************************************
    //transitionTo
    //***************************************
    function transitionTo(to, toParams, updateLocation, secondTry) {
      var toState = statesTree.getState(to);
      if (!toState && lazy && !secondTry) {
        return getLazyState(to).then(function() {
          return transitionTo(to, toParams, updateLocation, true);
        });
      }
      else {
        to = toState;

        if (!angular.isDefined(updateLocation)) {
          updateLocation = true;
        }

        if (to['abstract']) {
          throw new Error('Cannot transition to abstract state \'' + to + '\'');
        }
        var toPath = to.path,
            from = $detour.$current, fromParams = $detour.params, fromPath = from.path;

        // Starting from the root of the path, keep all levels that haven't changed
        var keep, state, locals = statesTree.locals, toLocals = [];
        for (keep = 0, state = toPath[keep];
             state && state === fromPath[keep] && equalForKeys(toParams, fromParams, state.ownParams);
             keep++, state = toPath[keep]) {
          locals = toLocals[keep] = state.locals;
        }

        // If we're going to the same state and all locals are kept, we've got nothing to do.
        // But clear 'transition', as we still want to cancel any other pending transitions.
        // TODO: We may not want to bump 'transition' if we're called from a location change that we've initiated ourselves,
        // because we might accidentally abort a legitimate transition initiated from code?
        if (to === from && locals === from.locals) {
          $detour.transition = null;
          return $q.when($detour.current);
        }

        // Normalize/filter parameters before we pass them to event handlers etc.
        toParams = normalize(to.preparedParams, toParams || {});

        // Broadcast start event and cancel the transition if requested
        if ($rootScope.$broadcast('$stateChangeStart', to.self, toParams, from.self, fromParams).defaultPrevented) {
          return TransitionPrevented;
        }

        // Resolve locals for the remaining states, but don't update any global state just
        // yet -- if anything fails to resolve the current state needs to remain untouched.
        // We also set up an inheritance chain for the locals here. This allows the view directive
        // to quickly look up the correct definition for each view in the current state. Even
        // though we create the locals object itself outside resolveState(), it is initially
        // empty and gets filled asynchronously. We need to keep track of the promise for the
        // (fully resolved) current locals, and pass this down the chain.
        var resolved = $q.when(locals);
        for (var l=keep; l<toPath.length; l++, state=toPath[l]) {
          locals = toLocals[l] = inherit(locals);
          resolved = resolveState(state, toParams, state===to, resolved, locals);
        }


        // Once everything is resolved, we are ready to perform the actual transition
        // and return a promise for the new state. We also keep track of what the
        // current promise is, so that we can detect overlapping transitions and
        // keep only the outcome of the last transition.
        var transition = $detour.transition = resolved.then(function () {
          var l, entering, exiting;

          if ($detour.transition !== transition) {
            return TransitionSuperseded;
          }

          // Exit 'from' states not kept
          for (l=fromPath.length-1; l>=keep; l--) {
            exiting = fromPath[l];
            if (exiting.self.onExit) {
              $injector.invoke(exiting.self.onExit, exiting.self, exiting.locals.globals);
            }
            exiting.locals = null;
          }

          // Enter 'to' states not kept
          for (l=keep; l<toPath.length; l++) {
            entering = toPath[l];
            entering.locals = toLocals[l];
            if (entering.self.onEnter) {
              $injector.invoke(entering.self.onEnter, entering.self, entering.locals.globals);
            }
          }

          // Update globals in $detour
          $detour.$current = to;
          $detour.current = to.self;
          $detour.params = toParams;
          angular.copy($detour.params, $stateParams);
          $detour.transition = null;

          // Update $location
          var toNav = to.navigable;
          if (updateLocation && toNav) {
            $location.url(toNav.preparedUrl.format(toNav.locals.globals.$stateParams));
          }

          $rootScope.$broadcast('$stateChangeSuccess', to.self, toParams, from.self, fromParams);

          return $detour.current;
        }, function (error) {
          if ($detour.transition !== transition) {
            return TransitionSuperseded;
          }

          $detour.transition = null;
          $rootScope.$broadcast('$stateChangeError', to.self, toParams, from.self, fromParams, error);

          return $q.reject(error);
        });

        return transition;
      }

    }
    $detour.transitionTo = transitionTo;

    $detour.is = function (stateOrName) {
      return $detour.$current === statesTree.getState(stateOrName);
    };

    $detour.includes = function (stateOrName) {
      var state = statesTree.getState(stateOrName);
      if (state) {
        return $detour.$current.includes[state.name];
      }
      else {
        return false;
      }
    };

    $detour.href = function (stateOrName, params) {
      var state = this.getState(stateOrName), nav = state.navigable;
      if (!nav) {
        throw new Error('State \'' + state + '\' is not navigable');
      }
      return nav.url.format(normalize(state.preparedParams, params || {}));
    };

    function resolveState(state, params, paramsAreFiltered, inherited, dst) {
      var dependencies = [];
      if (state.dependencies) {
        dependencies.push(
          $q.when(
            $injector.invoke(
              $couchPotato.resolveDependencies(state.dependencies)
            )
          )
        );
      }

      return $q.all(dependencies).then( function() {

        // We need to track all the promises generated during the resolution process.
        // The first of these is for the fully resolved parent locals.
        var promises = [inherited];

        // Make a restricted $stateParams with only the parameters that apply to this state if
        // necessary. In addition to being available to the controller and onEnter/onExit callbacks,
        // we also need $stateParams to be available for any $injector calls we make during the
        // dependency resolution process.
        var $stateParams;
        if (paramsAreFiltered) {
          $stateParams = params;
        }
        else {
          $stateParams = {};
          angular.forEach(state.preparedParams, function (name) {
            $stateParams[name] = params[name];
          });
        }
        var locals = { $stateParams: $stateParams };

        // Resolves the values from an individual 'resolve' dependency spec
        function resolve(deps, dst) {
          angular.forEach(deps, function (value, key) {
            promises.push($q
              .when(angular.isString(value) ?
                  $injector.get(value) :
                  $injector.invoke(value, state.self, locals))
              .then(function (result) {
                dst[key] = result;
              }));
          });
        }

        // Resolves the values from an individual 'resolveServices' dependency spec
        function resolveServices(deps, dst) {
          angular.forEach(deps, function (value, key) {
            promises.push($q
              .when(
                $injector.invoke([value, function(service) { return service.resolve($stateParams, locals); }])
              )
              .then(function (result) {
                dst[key] = result;
              }));
          });
        }

        // Resolve 'global' dependencies for the state, i.e. those not specific to a view.
        // We're also including $stateParams in this; that we're the parameters are restricted
        // to the set that should be visible to the state, and are independent of when we update
        // the global $detour and $stateParams values.
        var globals = dst.globals = { $stateParams: $stateParams };
        resolve(state.resolve, globals);
        resolveServices(state.resolveByService, globals);
        globals.$$state = state; // Provide access to the state itself for internal use


        // Resolve template and dependencies for all views.
        angular.forEach(state.preparedViews, function (view, name) {
          // References to the controller (only instantiated at link time)
          var $view = dst[name] = {
            $$controller: view.controller
          };

          // Template
          promises.push($q
            .when($templateFactory.fromConfig(view, $stateParams, locals) || '')
            .then(function (result) {
              $view.$template = result;
            }));

          // View-local dependencies. If we've reused the state definition as the default
          // view definition in .state(), we can end up with state.resolve === view.resolve.
          // Avoid resolving everything twice in that case.
          if (view.resolve !== state.resolve) {
            resolve(view.resolve, $view);
          }
        });


        // Once we've resolved all the dependencies for this state, merge
        // in any inherited dependencies, and merge common state dependencies
        // into the dependency set for each view. Finally return a promise
        // for the fully popuplated state dependencies.
        return $q.all(promises).then(function (values) {
          merge(dst.globals, values[0].globals); // promises[0] === inherited
          forEach(state.preparedViews, function (view, name) {
            merge(dst[name], dst.globals);
          });
          return dst;
        });
      });
    }

    function normalize(keys, values) {
      /*jshint eqeqeq:false */
      var normalized = {};

      forEach(keys, function (name) {
        var value = values[name];
        normalized[name] = (value != null) ? String(value) : null;
      });
      return normalized;
    }

    function equalForKeys(a, b, keys) {
      /*jshint eqeqeq:false */
      for (var i=0; i<keys.length; i++) {
        var k = keys[i];
        if (a[k] != b[k]) {
          return false; // Not '===', values aren't necessarily normalized
        }
      }
      return true;
    }

//***************************************
//URLPROVIDER
//***************************************

    // TODO: Optimize groups of rules with non-empty prefix into some sort of decision tree
    function update(event, next, current, secondTry) {
      var doFallback = !lazy || secondTry;

      var handled = statesTree.tryHandle($injector, $location, doFallback);
      if (handled) {
        if (isString(handled)) {
          $location.replace().url(handled);
        }
      }

      if (!handled && !secondTry && lazy) {
        getLazyRoute($location.path()).then(function() {
          update(event, next, current, true);
        });
      }
    }

    function getLazyRoute(route) {
      var deferred = $q.defer();

      stateLoader.getRoute(route, statesTree.knownStates).then(
        function(json) {
          if (json) {
            statesTree.mergeJson(json);
          }
          deferred.resolve();
        }
      );

      return deferred.promise;
    }

    function getLazyState(stateName) {
      var deferred = $q.defer();

      stateLoader.getState(stateName, statesTree.knownStates).then(
        function(json) {
          if (json) {
            statesTree.mergeJson(json);
          }
          deferred.resolve();
        }
      );

      return deferred.promise;
    }

    $rootScope.$on('$locationChangeSuccess', update);


//***************************************
//(end URLPROVIDER)
//***************************************

    return $detour;
  }
  $get.$inject = ['$rootScope', '$q', '$templateFactory', '$injector', '$stateParams', '$location', '$couchPotato', '$stateLoader'];
  this.$get = $get;

}
$DetourProvider.$inject = ['$urlMatcherFactoryProvider'];

angular.module('agt.detour')
  .value('$stateParams', {})
  .provider(detourSvc, $DetourProvider);
