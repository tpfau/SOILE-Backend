var vertx = require('vertx');
var console = require('vertx/console');


//Password hashing using SHA-256
function _hashPassword(password) {

  var messageDigest = java.security.MessageDigest.getInstance("SHA-256");
  var jpass = new java.lang.String(password);

  var bytes = messageDigest.digest(jpass.getBytes());

  var hexString = java.math.BigInteger(1, bytes).toString(16);

  console.log(hexString);

  return hexString;
}

var currentDate = new Date();
var millisecondsPerDay = 1000*3600*24

/*
Comparing start and end dates to calculate if an experiment 
should be active or not */
function _isActive(experiment) {
  sDate = new Date(experiment.startDate)
  eDate = new Date(experiment.endDate)

  if((sDate < currentDate)&&(currentDate<eDate)) {
    experiment.active = true;
    experiment.timedata = Math.ceil((eDate - currentDate)/millisecondsPerDay);
  }
  else{
    experiment.active = false;

    if(sDate > currentDate) {
      experiment.timedata = Math.ceil((sDate - currentDate)/millisecondsPerDay);
    }
  }

  return experiment;
}

var mongoHandler = {
  mongoAddress: "vertx.mongo-persistor",
  init: function(){
    this.setIndexes();
    this.ensureAdmin();
  },

  getExperiment: function(id, response) {
    currentDate = new Date();
    vertx.eventBus.send("vertx.mongo-persistor",{"action":"findone", 
   "collection":"experiment","matcher":{"_id":id}},function(reply){

      if(reply.result) {
        sDate = new Date(reply.result.startDate);
        eDate = new Date(reply.result.endDate);

        if((sDate < currentDate)&& (currentDate < eDate)) {
          reply.result.active = true;
        } else { reply.result.active = false}
      }

      response(reply);

    });
  },

  getExperimentFormData: function(id, response) {
    vertx.eventBus.send(this.mongoAddress, {"action":"find",
    "collection":"formdata",
    "matcher":{"expId":id, "confirmed":true},
    "keys": {"confirmed":0}},
     function(reply) {
      response(reply);
    })
  }
  ,

  addFormToExperiment: function(expid,formid, name,response) {
    vertx.eventBus.send(this.mongoAddress, {
      "action":"update",
      "collection":"experiment",
      "criteria":{
        "_id":expid
      },
      "objNew": {
        "$push":{
          "components":{
            "id":formid,
            "name":name, 
            "type":"form"
          }
        }
      }
    }, function(reply){
      console.log(JSON.stringify(reply))
      response(reply);

    })
  },

  addTestToExperiment: function(expid,testid, name,response) {
    vertx.eventBus.send(this.mongoAddress, {
      "action":"update",
      "collection":"experiment",
      "criteria":{
        "_id":expid
      },
      "objNew": {
        "$push":{
          "components":{
            "id":testid,
            "name":name, 
            "type":"test"
          }
        }
      }
    }, function(reply){
      console.log(JSON.stringify(reply))
      response(reply);

    })
  },
/*
  Mongo example that should work

db.experiment.update({_id:"c2aa8664-05b7-4870-a6bc-68450951b345",
"components.id":"59cecd81aca2c289942422d904ef495dfc21a6a3"},
{$set:{"components.$.name":"MY new name"}})

*/

  editExperimentFormName: function(expid, formid, name, response) {

    var query = {
      "action":"update",
      "collection":"experiment",
      "criteria":{
        "_id":expid,
        "components.id":formid
      },
      "objNew":{"$set":{"components.$.name":name}}
      }
    //var command = "db.experiment.update({'_id':'"+expid+"','components.id':'"+formid+"'},{$set:{'components.$.name':'"+name+"''}})";
    // console.log("\n"+command+"\n");
    vertx.eventBus.send(this.mongoAddress, query, function(reply){
      response(reply);
    })
  },


// http://stackoverflow.com/questions/4588303/in-mongodb-how-do-you-remove-an-array-element-by-its-index
// The above method could also be used 
  deleteComponentFromExperiment: function(expid, compid, response) {

    var query =  {
      "action":"update",
      "collection":"experiment",
      "criteria":{
        "_id":expid,
        "components.id":compid
      },
      "objNew":{"$pull":{"components":{"id":compid}}}
    };
    

    vertx.eventBus.send(this.mongoAddress, query, function(reply) {
      response(reply);
    });
  },

  getExperimentList: function(response) {
    vertx.eventBus.send("vertx.mongo-persistor",{"action":"find",
    "collection":"experiment"},function(reply){
      if(reply.results) {
        for(var i =0; i<reply.results.length;i++) {
          reply.results[i] = _isActive(reply.results[i]);
        }
      }
      response(reply);
    })
  },

  
  saveExperiment: function(exp,response){
    vertx.eventBus.send(this.mongoAddress, {"action":"save", 
      "collection":"experiment", "document":exp}, function(reply){
        response(reply);
      })
  },

  updateExperiment: function(exp, id, response){
    vertx.eventBus.send(this.mongoAddress, {"action":"update", 
      "collection":"experiment", "criteria":{"_id":id},
      "objNew":{"$set":exp}}, function(reply){
        response(reply);
      })
  },

  //Saves a form, does 
  saveForm: function(name, form, id, response) {
    vertx.eventBus.send("vertx.mongo-persistor",{"action":"save",
      "collection":"forms","document":{"form":form}}, function(reply){
        response(reply)
      })
  },

  getForm: function(id, response){
    vertx.eventBus.send("vertx.mongo-persistor", {"action":"findone",
    "collection":"forms","matcher":{"_id":id}}, function(reply) {
      response(reply);
    })
  },

  saveTest: function(test,response) {
    test.compiled = false;
    vertx.eventBus.send(this.mongoAddress, {"action":"save",
    "collection":"tests","document":test}, function(reply) {
      response(reply)
    })
  },
  updateTest: function(test,response) {
    vertx.eventBus.send(this.mongoAddress, {"action":"update",
    "collection":"tests", "criteria":{"_id":test._id},
    "objNew":{"$set":{
        "code": test.code,
        "js": test.js,
        "compiled":test.compiled
      }
    }}, function(reply) {
      response(reply)
    })
  }
  ,

  getTest: function(id, response){
    vertx.eventBus.send(this.mongoAddress, {"action":"findone",
    "collection":"tests","matcher":{"_id":id}}, function(reply) {
      response(reply);
    });
  },

  getTestList: function(response){
    vertx.eventBus.send(this.mongoAddress, {"action":"find",
    "collection":"tests"}, function(reply) {
      response(reply);
    });
  },

  saveData: function(phase, experimentid ,data, userid,response) {
    var doc = data;
    data.phase = phase;
    data.expId = experimentid;
    data.userid = userid
    data.confirmed = false;
    
  this.getExperiment(experimentid, function(r) {
      var type = r.result.components[phase].type;
      data.type = type;

      console.log(mongoHandler.mongoAddress);

      if(type === "form"){
        vertx.eventBus.send(mongoHandler.mongoAddress, {"action":"save",
        "collection":"formdata", "document":doc}, function(reply) {
          response(reply);
        });
      }
      if(type==="test") {
        vertx.eventBus.send(mongoHandler.mongoAddress, {"action":"save",
        "collection":"testdata", "document":doc}, function(reply) {
          response(reply);
        });
      }
    });
  },

  getUserPosition: function(userid, experimentid, response) {

    vertx.eventBus.send(this.mongoAddress, {
      "action":"find",
      "collection":"formdata",
      "matcher":{
        "userid":userid,
        "expId":experimentid
      },
      "sort":{"phase":-1},
      "limit":1},
      function(reply) {
        console.log(JSON.stringify(reply));

        if(reply.number == 1) {
          response(parseInt(reply.results[0].phase));
        }else {
          response(-1);
        }
    });
  },

  // Setting a confirmed flag on submitted data. 
  // This is run when an user successfully reaches the end
  // of an experiment.

  confirmExperimentData: function(expId, userid, response) {

    //Confirming testdata.
    vertx.eventBus.send(this.mongoAddress, {"action":"update",
    "collection":"testdata", "criteria":{"expId":expId, "userid":userid}, 
    "objNew":{"$set":{
        "confirmed":true
      }},
    "multi":true
    }, function(reply) {
      console.log("confirming testdata");
      console.log(JSON.stringify(reply));
    });

    //Confirming formdata
    vertx.eventBus.send(this.mongoAddress, {"action":"update",
    "collection":"formdata", "criteria":{"expId":expId, "userid":userid}, 
    "objNew":{"$set":{
        "confirmed":true
      }},
    "multi":true
    }, function(reply) {
      response(reply);
    })
  },

  authUser: function(username, password, response) {

    var pass = _hashPassword(password);

    vertx.eventBus.send(this.mongoAddress, {"action":"findone",
    "collection":"users", "matcher":{"username":username, "password":pass}},
    function(reply) {

      console.log("Finding user");
      console.log(JSON.stringify(reply));
      if(reply.result==null) {
        reply.status="notfound";
      }
      
      response(reply);
    })
  },

  newUser: function(username, password, response) {

    var pass = _hashPassword(password);

    vertx.eventBus.send(this.mongoAddress, {"action": "save",
    "collection":"users", "document":{"username":username, "password":pass, "admin":false}},
     function(reply) {
      response(reply);
     })
  },

  //Function that sets all indexes at startup
  setIndexes: function() {
    vertx.eventBus.send(this.mongoAddress, {"action": "command",
    "command":
      "{eval: 'function() {db.users.ensureIndex({username:1}, {unique: true});}', args: []}" }, 
      
      function(reply) {
        console.log("Setting user index");
        console.log(JSON.stringify(reply));
      })
  },

  ensureAdmin: function() {

    var pass = _hashPassword("admin")
    vertx.eventBus.send(this.mongoAddress, {"action":"save",
    "collection":"users", "document":{"_id": 1,
                                      "username":"admin",
                                      "password": pass,
                                      "admin":true }},
    function(reply) {
      console.log("Generated admin");
    });
  },

  updateExpData: function(userid, personToken,response) {

    vertx.eventBus.send(this.mongoAddress, {"action":"update",
      "collection":"formdata",
      "criteria": {
        "userid":personToken,
        "confirmed":false
      },
      "objNew": {
        "$set":{
          "userid":userid
        }
      },
      "multi": true
    },
    function(reply) {
      console.log(reply);
      response(reply);
    })
  }

  // _hashPassword: function(password) {
  //   var messageDigest = java.security.MessageDigest.getInstance("SHA-256");
  //   var jpass = new java.lang.String(password);

  //   var bytes = messageDigest.digest(jpass.getBytes());

  //   console.log(bytes);
  // }
};

module.exports = mongoHandler;