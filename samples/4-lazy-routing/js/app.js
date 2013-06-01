define([], function () {
  'use strict';

  var app = angular.module('app', ['agt.detour']);

  app.config([ '$locationProvider', '$provide', '$detourProvider', '$stateLoaderProvider',
    function($locationProvider, $provide, $detourProvider, $stateLoaderProvider) {
      //comment out the decorator function for html5mode
      //uncomment the decorator function for forced hash(bang) mode
      // $provide.decorator('$sniffer', function($delegate) {
      //   $delegate.history = false;
      //   return $delegate;
      // });
      $locationProvider.html5Mode(true);

      $detourProvider.lazy = true;
      $stateLoaderProvider.getRouteUrl = '/svc/getRoute';
      $stateLoaderProvider.getStateUrl = '/svc/getState';
      $stateLoaderProvider.getUpdatesUrl = '/svc/getUpdates';
    }
  ]);

  app.run([ '$rootScope', '$detour', '$stateParams', '$stateLoader',
    function($rootScope,   $detour,   $stateParams, $stateLoader) {

      $detour.setStateLoader($stateLoader);

      //"cheating" so that detour is available in requirejs
      //define modules -- we want run-time registration of components
      //to take place within those modules because it allows
      //for them to have their own dependencies also be lazy-loaded.
      //this is what requirejs is good at.

      //if not using any dependencies properties in detour states,
      //then this is not necessary
      app.detour = $detour;


      //the sample reads from the current $detour.state
      //and $stateParams in its templates
      //that it the only reason this is necessary
      $rootScope.$detour = $detour;
      $rootScope.$stateParams = $stateParams;
    }
  ]);

  return app;

});
