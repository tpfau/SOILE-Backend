var app = angular.module('experimentEdit', ['ui.tree', 'ui.bootstrap', 'ui.select', 'ngSanitize']);


app.config(function($interpolateProvider){
    $interpolateProvider.startSymbol('[([').endSymbol('])]');
});


/*Marks html as safe*/
app.filter('unsafe', function($sce) { return $sce.trustAsHtml; });

//Reverses the order of an array
app.filter("reverse", function(){
    return function(items){
        return items.slice().reverse();
    };
});

app.filter('propsFilter', function() {
  return function(items, props) {
    console.log(items);
    console.log(props);
  };
});

app.controller('componentController', function($scope, $http, $location) {
    var baseUrl = $location.absUrl();

    $scope.delComponent = function(type,index) {
        console.log("Deleting " + type + " : " + index);
        $scope.experiment.components.splice(index, 1);
    }

});

app.controller('experimentController', function($scope, $http, $location) {
    var baseUrl = $location.absUrl();

    //$scope.formats = ['dd-MMMM-yyyy', 'yyyy/MM/dd', 'dd.MM.yyyy', 'shortDate'];
    $scope.format = 'yyyy/MM/dd';
    $scope.test = {};   


    function loadData() {
      $http.get("json").success(function(data,status) {
          console.log(data)
          $scope.experiment = data;

          $scope.startdate = new Date($scope.experiment.startDate);
          $scope.enddate = new Date($scope.experiment.endDate);
      });
    }

    $scope.open = function($event) {
      $event.preventDefault();
      $event.stopPropagation();

      console.log("OPEN");

      $scope.opened = true;
    };

    $scope.dateOptions = {
      formatYear: 'yy',
      startingDay: 1
    };

    $scope.save = function save() {
        console.log("SSSSAAAVVE")
        var data = $scope.experiment;

        data.startDate = $scope.startdate.toISOString();
        data.endDate = $scope.enddate.toISOString();

        $http.post(baseUrl, data)

    }

    $scope.refreshTests = function(search) {
      return $http.get('/test/json')
      .then(function(response) {
        $scope.tests = response.data;
        console.log($scope.tests);
      });
    }

    loadTests = function() {
      return $http.get('/test/json')
      .then(function(response) {
        $scope.tests = response.data;
      });
    }

    $scope.addTest = function() {
      var compObject = {};
      compObject.name = $scope.test.selected.name;
      compObject._id = $scope.test.selected._id;
      compObject.type = "test";

      $scope.experiment.components.push(compObject);

      $scope.test.selected = null

    }

    $scope.addForm = function() {
      $http.post('addform')
      .then(function(response) {
        var data = response.data;

        var compObject = {};
        compObject.name = "";
        compObject.id = data._id;
        compObject.type = "form";

        $scope.experiment.components.push(compObject);

        $scope.save();
      });
    }

    //$scope.startdate = new Date();
    //$scope.enddate = new Date();

    loadTests();
    loadData();
});