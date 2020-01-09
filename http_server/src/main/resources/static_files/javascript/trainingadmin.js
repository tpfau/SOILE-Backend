var app = angular.module('trainingAdmin', ['angularMoment', 'ui.bootstrap']);

app.config(function($interpolateProvider){
    $interpolateProvider.startSymbol('[([').endSymbol('])]');
});

app.config(['$compileProvider', function ($compileProvider) {
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(|blob|):/);
}]);

/**
 * Generate buffer from excel workbook
 * @param  {[type]} s [description]
 * @return {[type]}   [description]
 */
function s2ab(s) {
  var buf = new ArrayBuffer(s.length);
  var view = new Uint8Array(buf);
  for (var i=0; i!=s.length; ++i) view[i] = s.charCodeAt(i) & 0xFF;
  return buf;
}

/*Marks html as safe*/
app.filter('unsafe', function($sce) { return $sce.trustAsHtml; });

app.service('overviewService', function($http, $location, $q) {
    this.users = [];
    this.training = null;

    var promise = false;

    var deferred = $q.defer();

    var that = this;

    //Gets the list of nuclear weapons
    this.getUsers = function() {
      if (!promise) {
        promise = $http.get($location.absUrl() + "/useroverview").success(function(data,status) {
          //users = JSON.parse(data.participants);
          that.users = data.participants.map(function(obj){return JSON.parse(obj)});
          that.training = JSON.parse(data.training);

          console.log("RESOLVING THEN")
          deferred.resolve("success");

        });
      }

      return deferred.promise;
    };

    // Fill the list with actual nukes, async why not.
    //this.getUsers();

    /*return {
      users:users,
      training:training
    };*/


        // expose more functions or data if you want

});

app.controller('overallStatsController', function ($scope, $http, $location, overviewService) {
  var baseUrl = $location.absUrl();
  var vm = this;
  $scope.loadData = function () {
    /*$http.get($location.absUrl() + "/useroverview").success(function(data,status) {
        console.log("Load ing data");
      console.log(data);
      //$scope.participants = JSON.parse(data.participants);
      $scope.participants = data.participants.map(function(obj){return JSON.parse(obj)});
      $scope.training = JSON.parse(data.training);*/
    overviewService.getUsers().then(function () {
      $scope.participants = overviewService.users;
      $scope.particpantCount = overviewService.users.length;

      $scope.completed = 0;
      overviewService.users.forEach(user => {
        console.log(user);
        if (user.mode == "done") {
          $scope.completed += 1;
        }
      });
    })
  }

  $scope.loadData()
});

app.controller('userProgressController', function($scope, $http, $location, overviewService) {
  var baseUrl = $location.absUrl();

  $scope.rowClass = function(user){
    if (user.mode == "done") {
      return "completed"
    }
    else {
      return "";
    }
  };


  $scope.loadData = function() {
    /*$http.get($location.absUrl() + "/useroverview").success(function(data,status) {
        console.log("Load ing data");
      console.log(data);
      //$scope.participants = JSON.parse(data.participants);
      $scope.participants = data.participants.map(function(obj){return JSON.parse(obj)});
      $scope.training = JSON.parse(data.training);*/
    overviewService.getUsers().then(function() {

      $scope.participants = overviewService.users;
      $scope.training = overviewService.training;

      for (var i = 0; i < $scope.participants.length; i++) {

        $scope.participants[i].timestamp = new Date($scope.participants[i].timestamp);

        var hoursTilDone = 0;
        hoursTilDone = (2 + parseInt($scope.training.repeatcount)) * $scope.training.maxpause;
        var p = $scope.participants[i];
        if(p.mode === "done") {
          $scope.participants[i].percentageDone = 100;
          hoursTilDone = 0;
        }

        if(p.mode === "pre") {
          $scope.participants[i].percentageDone = 0;
        }

        if(p.mode === "training") {
          console.log("Pos " + (parseInt(p.trainingIteration)+1) + " repeatcount " + (parseInt($scope.training.repeatcount)+2)  + " res " + (parseInt(p.position) + 1)/(parseInt($scope.training.repeatcount) + 2));
          $scope.participants[i].percentageDone = parseInt((parseInt(p.trainingIteration) + 1)/(parseInt($scope.training.repeatcount) + 2)*100);
          hoursTilDone -= (1 + p.trainingIteration) * $scope.training.maxpause;
        }

        if(p.mode === "post") {
          $scope.participants[i].percentageDone = ($scope.training.repeatcount + 2 - 1)/($scope.training.repeatcount + 2)*100;
          hoursTilDone = $scope.training.maxpause;
        }

        p.hoursTilDone = moment().add(hoursTilDone, "hours");

      }

      $scope.participants.sort(function(a, b){
          if(a.timestamp < b.timestamp) return -1;
          if(a.timestamp > b.timestamp) return 1;
          return 0;
      });

    });
  };


  $scope.loadData();
});


app.controller('trainingDataFilterController', function($scope, $http, $location, $window,overviewService) {
  var baseUrl = $location.absUrl();
  var vm = this;
  // this.
  vm.downloadData = false;
  vm.format = 'yyyy/MM/dd';

  vm.open = function($event) {
    $event.preventDefault();
    $event.stopPropagation();

    vm.opened = true;
    };

  vm.getUsers = function() {
    return vm.users;
  };

  vm.getUsersWithAll = function() {
    return vm.usersWithall;
  };


  /*
    Returns a array with trainingiterations
  */
  vm.getIterations = function() {
    var arr = [];
    var iterations = vm.training.repeatcount;
    for (var i = 0; i < iterations; i++) {
      arr.push(i+1);
    }

    return arr;
  };
  /*
    Returns an array with component numbers
  */
  vm.getComponentIterations = function(phase) {
    var arr = [];
    var iterations = vm.training.components[phase].length;
    console.log(vm.training.components[phase].length);
    for (var i = 0; i < iterations; i++) {
      arr.push(i+1);
    }

    return arr;
  };

  vm.buildQuery = function() {
    var base = baseUrl + "/loaddata?";
    var query = base;

    if (vm.filter1 === "pre" || vm.filter1 === "post") {
      vm.filter4 = undefined;

      if(vm.filter2 === "single") {
        vm.filter3 = undefined;
      }
    }

    if (vm.filter1 === "training") {

      if(vm.filter3 === "single") {
        vm.filter4 = undefined;
      }
    }

    query += "f1=" + (vm.filter1 ? vm.filter1 : "") + "&";
    query += "f2=" + (vm.filter2 ? vm.filter2 : "") + "&";
    query += "f3=" + (vm.filter3 ? vm.filter3 : "") + "&";
    query += "f4=" + (vm.filter4 ? vm.filter4 : "") + "&";

    var startDateString = (vm.startdate ? vm.startdate.toISOString(): "");
    var endDateString =   (vm.enddate ? vm.enddate.toISOString(): "");

    query += "startdate=" + startDateString + "&";
    query += "enddate=" +    endDateString + "&";

    console.log(query);

    $http.get(query).success(function(data, status) {

      vm.downloadData = true;
      var link = angular.element( document.querySelector( '#dlLink' ) );

       link.attr({
           href: 'data:attachment/csv;charset=utf-8,' + encodeURI(data),
           target: '_blank',
           download: 'data.csv'
       });

       console.log(link)

       CSV.RELAXED = true;
       CSV.COLUMN_SEPARATOR = ";";

       var jsonData = CSV.parse(data);

       vm.datarows = jsonData;

      var excelWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(excelWb, XLSX.utils.json_to_sheet(jsonData), "Data");

      var wbout = XLSX.write(excelWb, {bookType:'xlsx', type:'binary'});
      var excelBolb =new Blob([s2ab(wbout)],{type:"application/octet-stream"});
      var excelUrl = $window.URL || $window.webkitURL;
      vm.fileUrlExcel = excelUrl.createObjectURL(excelBolb);
    });
  };

  overviewService.getUsers().then(function() {
    vm.users = overviewService.users;
    // vm.users.unshift({userId:"all"});
    vm.usersWithall = vm.users.slice(0);
    vm.usersWithall.unshift({ userId: "all" });
    vm.training = overviewService.training;
  });

 /* overviewService.loadData(function(data) {
    $scope.users = data.users;
  });*/
});