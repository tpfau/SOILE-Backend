var vertx = require("vertx");
var CustomMatcher = require('router');
var console = require('vertx/console');

var templateManager = require('templateManager');
var router = new CustomMatcher();

var trainingModel = require("models/Models").Training;
var trainingDAO = require("models/DAObjects").TrainingDAO;

var TrainingData = require("models/Models").TrainingData;

var formModel = require("models/Models").Form;

var trainingDataDAO = require("models/DAObjects").TrainingDataDAO;

var testDAO = require("models/DAObjects").TestDAO;
var formDAO = require("models/DAObjects").FormDAO;

var moment = require("libs/moment");

var requireAdmin = require('middleware').requireAdmin;

var m1 = require('middleware').m1;
var m2 = require('middleware').m2;

var utils = require("utils");

var babyparser = require("libs/babyparse");


/*
Architectural ideas. 

Tränings experimentet sparar:
  pre komponenter
  post komponenter
  training komponenter
  dataumintervall
  
Per användare sparas: 
  Var i testen en person er: pre - träning - post?
  Data för varje fas, samma som i ett vanligt experiment
  Datum intervall för nästa träning

Urlar:
  /training       -  allmän information samt status för var i testet användaren e.
  /training/pre   -  pre
  /training/post  -  post
  /training/task  -  träningsuppgift
  
  Skippa juttun med faser, istället visas bara rätt experiment/form
  kan ju ändu int navigera mellan olika juttun så, och soile sköter 
  ändå om allt redirectande.

  såå flöde /training -> training/pre -> /training/task (repeat) -> training/post -> /training
*/

/*
Overwrites obj1's values with obj2's and adds obj2's if non existent in obj1
*/

function periodicReminder() {
  console.log("Running reminder");

  /*
    Select active trainings...

    Select active users.

    Find users who are near the dropout timelimit.

    Send email
  */
}

/*var timerID = vertx.setPeriodic(10000, function(timerID) {
    periodicReminder();
});
*/


function merge_options(obj1,obj2){
    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}

//Handles saving of posted data from tests
function handleResultData(data, datatype, callback) {

}

//Admin view, show list of training experiments
router.get("/training", requireAdmin,function(request) {
  console.log("Training List is running ");

  trainingDAO.list(function(training) {
    templateManager.render_template("trainingList", {"trainings":training}, request);
  });

});

//Create a new training task 
router.post("/training", requireAdmin,function(request) {

  var sDate = Date.now() + (1000*60*60*24*2); //Two days in the future
  var eDate = Date.now() + (1000*60*60*24*30);  //30 days in the future

  var newTraining = new trainingModel();

  newTraining.startDate = new Date(sDate);
  newTraining.endDate = new Date(eDate);
  newTraining.name = "";

  newTraining.save(function(callback) {
      request.redirect("/training/"+newTraining._id+"/edit");
      request.response.end();

  });
});

//View  training experiment
router.get("/training/:id",function(request) {
  var id = request.params().get('id');
  var userid = request.session.getUserId();

  // Get training
  trainingDAO.get(id, function(training) {
    console.log("##### FIRST TRAINING");
    console.log(JSON.stringify(training));

    if (request.session.isAdmin()) {
      return trainingAdminView(request, training);
    }

    return trainingView(request, training);
  });
});

function trainingView(request, training) {
  var id = training._id;
  var userid = request.session.getUserId();

  trainingDataDAO.getGeneralData(userid, id, function(trainingData) {

    if(trainingData === "") {
      templateManager.render_template('trainingLanding',{training:training},request);
      return;
    }

    var status = {};
    status.open = false;
    status.state = trainingData.getMode();
    status.nextRound = training.nextTask;

    trainingData.nextTask = new Date(trainingData.nextTask);

    var timeString = false;
    if(trainingData.nextTask - Date.now() > 0) {
      timeString = moment(trainingData.nextTask).fromNow();
      console.log("Timestring " + timeString);
    }

    status.timeLeft = timeString;

    var tasksLeft = parseInt(training.repeatcount) - parseInt(trainingData.position);
    var hoursLeft = tasksLeft * parseInt(training.repeatpause);

    console.log("HOURS LEFT " + hoursLeft  + " taskleft " + tasksLeft + " repeat " + training.repeatcount + " pause " + training.repeatpause);

    //status.totalTimeLeft = moment(trainingData.nextTask).add(hoursLeft, "hours").fromNow();
    status.totalTimeLeft = moment(Date.now()).add(hoursLeft, "hours").fromNow(true);
    if(timeString) {
      status.totalTimeLeft = moment(trainingData.nextTask).add(hoursLeft, "hours").fromNow(true);
    }

    status.deadline = moment(Date.now()).add(training.maxpause, "hours").fromNow(true);

    var totalRounds = parseInt(training.repeatcount) + 2;
    var roundsDone = 0;

    var mode = trainingData.getMode();

    if (mode === "training") {
      roundsDone = trainingData.trainingIteration + 1;
    }

    if (mode === "post") {
      roundsDone = totalRounds - 1;
    }

    if (mode === "done") {
      roundsDone = totalRounds;
    }

    if (training.components.pre.length === 0) {
      roundsDone -= 1;
      totalRounds -= 1;
    }

    if (training.components.post.length === 0) {
      //roundsDone -= 1;
      totalRounds -= 1;
      if (mode === "done") {
        roundsDone -= 1;
      }
    }

    status.roundsLeft = roundsDone + "/" + totalRounds;
    status.percentageDone = roundsDone/totalRounds * 100;

    status.roundType = mode;
    status.iteration = trainingData.trainingIteration;


    status.showscore = true;
    if (trainingData.trainingIteration == 0) {
      status.showscore = false;
    }

    if (!training.showScore) {
      status.showscore = false;
    }

    status.done = false;
    if (mode === "done") {
      /*trainingDataDAO.getPrePostScore(id, userid, function(pre, post) {
        status.preScore = pre;
        status.postScore = post;
      });*/
      status.done = true;
    }

    if (status.showscore) {
      
      trainingDataDAO.getScoreHistory(id, userid, function(score) {
        status.scoreHistory = score;
        templateManager.render_template('trainingUser', {training:training, status:status}, request);
      });
    } else {
      templateManager.render_template('trainingUser', {training:training, status:status}, request);
    }
  });
}

function trainingAdminView(request, training) {
  var id = training._id;
  var userid = request.session.getUserId();

  var cData = [["Pre", 123], ["1", 63],["2", 55],["3", 32],["Post", 19]];
  return templateManager.render_template("trainingAdmin", {training:training, chartData:cData}, request);
}

/*
b3608da6-aef4-49aa-8e25-1210bc377254,f38699cf-d4e8-42da-8d7c-643b3952e067
*/
/*
  Manually enroll a user into a training experiment. Does the same thing as
  when a user clicks the participate button. The user will see that he is participating
  in the test at the user view after logging in.
*/
router.post("/training/:id/enrolluser", requireAdmin,function (request) {
  var data = new vertx.Buffer();
  var trainingId = request.params().get('id');

  request.dataHandler(function(buffer) {
    data.appendBuffer(buffer);
  });

  request.endHandler(function() {

    var params = data.getString(0, data.length());
    params = utils.getUrlParams(params);


    console.log(JSON.stringify(params))

    params = params.userids;

    console.log(JSON.stringify(params))

    if (typeof params === "undefined" || params == "") {
      request.redirect(request.absoluteURI());
      return;
    }

    var ids = params.split(",");
    var usersEnrolled = 0;

    function redirectToTraining() {
      request.redirect("/training/" + trainingId);
    }

    function enrollUsers(next) {
      var id = next.pop();

      var func = enrollUsers;

      if (id === undefined) {
        redirectToTraining();
      } else {
        trainingDAO.enrollUser(trainingId, id, function(res, enrollStatus) {
          if (enrollStatus) { 
            usersEnrolled += 1;
          }
          func(next);
        });
      }
    }

    enrollUsers(ids);
  });

});

//Save data to the experiment
router.post("/training/:id/participate", function(request) {
  var id = request.params().get('id');
  var userid = request.session.getUserId();

  trainingDAO.get(id, function(training) {

    //trainingDataDAO.getOrGenerateGeneral(userid, id, training.controlgroup, function(trainingData) {
    trainingDataDAO.getOrGenerateGeneral(userid, training, function(trainingData) {
      request.redirect("/training/" + id);
    });
  });
});

function getTrainingAndUserData(trainingid, userid, callback) {

  trainingDAO.get(trainingid, function(training) {

    trainingDataDAO.get({userId:userid, trainingId:trainingid, type:"general"}, function(trainingData) {
      var data = {};
      data.training = training;
      data.trainingData = trainingData;

      console.log(JSON.stringify(data));

      callback(data.training, data.trainingData);
    });
  });
}

function renderTrainingPhase(components, position, translatedPhase,request, persistantData, training) {

  var component = components[translatedPhase];
  var id = component.id;
  var template = "";
  var dao = {};
  var context = {};
  var contextObj = "";
  var childObj = 0;

  var phasesLeft = components.length - position;

  if(component.type === "form") {
    dao =formDAO;
    template = "formphase";
    contextObj = "form";
    childObj = "form";
  }

  if(component.type === "test") {
    dao = testDAO;
    template = "testphase";
    contextObj = "test";
    context.persistantData = persistantData;
  }

  context.completed = ((position+1)/components.length * 100);
  context.phasesLeft = (parseInt(position) + 1) + "/" + components.length;

  dao.get(id, function(phase) {

    context[contextObj] = phase;

    if (training.submitbutton) {
      context.submitbutton = training.submitbutton;
    }

    if (childObj !== 0) {
      context[contextObj] = phase[childObj];
    }

    console.log(JSON.stringify(context));

    templateManager.render_template(template, context, request);
  });

}

//Execute current training phase
router.get("/training/:id/execute", function(request) {
  var id = request.params().get('id');
  var userid = request.session.getUserId();

  getTrainingAndUserData(id, userid, function(training, trainingData) {

    if(trainingData.mode === "done") {
      return request.redirect("/training/" + id);
    }

  /* if(trainingData.mode === "training" && trainingData.inControlGroup) {
      trainingData.mode = "control";
    }*/

    var modeComponents = training.components[trainingData.getMode()];
    var positionInMode = parseInt(trainingData.position);

    var modeComponents = training.getComponentsForRound(trainingData);

    var phasesLeft = modeComponents.length - (positionInMode);

    var phase = positionInMode;

    var isRandom = training.isRandom();
    if (isRandom) {
      console.log(JSON.stringify(isRandom));
      if (isRandom[trainingData.getMode()] && trainingData.checkRandom()) {
        console.log("Random translation " + positionInMode + " -> " +  trainingData.randomorder[trainingData.getMode()][positionInMode]);
        phase = trainingData.randomorder[trainingData.getMode()][positionInMode];
      }
    }

    console.log("Executin training");
    console.log("mode = " + trainingData.getMode() + " position:" + positionInMode);
    console.log("Component:" + JSON.stringify(modeComponents[positionInMode]));

    var nextTaskTime = new Date(trainingData.nextTask);

    //if (phasesLeft == 0) {
    if(Date.now() - nextTaskTime < 0 || trainingData.getMode() === "done") {
      return request.redirect("/training/" + id);
    }
     else {
      renderTrainingPhase(modeComponents, positionInMode, phase,request, trainingData.persistantData, training);
    }
  });

});

//Recieve and stora data from training phase
router.post("/training/:id/execute", function(request) {
  var id = request.params().get('id');
  var postData = new vertx.Buffer();

  request.dataHandler(function(buffer){
    postData.appendBuffer(buffer);
  });

  request.endHandler(function() {

    var userid = request.session.getUserId();
    //Figures out the current phase and creates a data object.
    getTrainingAndUserData(id, userid, function(training, generalData) {
      var jsonData = JSON.parse(postData.getString(0, postData.length()));

      //var modeComponents = training.components[generalData.mode];
      //var positionInMode = generalData.position;

      var tData = new TrainingData();
      var oldMode = generalData.getMode();
      tData.data = jsonData.exp;
      tData.mode = generalData.getMode();
      tData.phase = generalData.position;

      //Random order, save testdata with the right phase number
      var isRandom = training.isRandom();
      if (isRandom) {
        if (isRandom[generalData.getMode()] && generalData.checkRandom()) {
          console.log("###SAVE### Random translation " + generalData.position + " -> " +  generalData.randomorder[generalData.getMode()][generalData.position]);
          tData.phase = generalData.randomorder[generalData.getMode()][generalData.position];
        }
      }

      tData.trainingId = id;

      tData.userId = generalData.userId;

      tData.duration = jsonData.duration;
      tData.score = jsonData.score;

      if(generalData.mode === "training") {
        tData.trainingIteration = generalData.trainingIteration;
      }

      console.log(JSON.stringify(jsonData));

      tData.save(function(status) {
        console.log("SAVED TDATA" + JSON.stringify(status));

        var isLastPhase = generalData.isLastPhase(training);
        generalData.completePhase(training);

        generalData.persistantData = merge_options(generalData.persistantData,
                                                   jsonData.persistantData);

        generalData.save(function() {
          
          //TODO: Check if there is any stored score
        if (isLastPhase) {
          if(training.showScore && oldMode !== "pre") {
            request.jsonRedirect("/training/"+id+"/score");
          }
          else {
            request.jsonRedirect("/training/"+id);
          } 
        }
        else {
          request.jsonRedirect("/training/"+id+"/execute");
        }

        });
      });
    
    });
  });
});

//Execute current training phase
/*
router.get("/training/:id/execute/json", function(request) {
  var id = request.params().get('id');
  var userid = request.session.getUserId();

  getTrainingAndUserData(id, userid, function(d) {
    var modeComponents = training.components[trainingData.mode];
    var positionInMode = trainingData.position;

    var phasesLeft = modeComponents.length - positionInMode;

    console.log("Executin training");
    console.log("mode = " + trainingData.mode + " position:" + positionInMode);
    console.log("Component:" + JSON.stringify(modeComponents[positionInMode]));
    if (phasesLeft = 0) {

    } else {
      renderTrainingPhase(modeComponents, positionInMode, request);
    }
  });

});
*/

router.get("/training/:id/score", function(request) {
  var id = request.params().get('id');
  var userid = request.session.getUserId();

  var context = {};
  trainingDAO.get(id, function(trainingObject) {

    context.showscore = trainingObject.showScore;
    context.sessionMessage = trainingObject.completeSessionMessage;
    if (trainingObject.showScore) {
      //Fetch score and stuff
      trainingDataDAO.getScore(id, userid, function(totalScore, scores) {

        var scoreContext = {};

        scoreContext.totalScore = totalScore;
        scoreContext.scores = [];

        for (var i = 0; i < scores.length; i++) {
          var s = scores[i];
          scoreContext.scores[i] = {"score":s.score};
          scoreContext.scores[i].subscores = [];
          for(var key in s) {
            if (key !== "score") {
              var subScore = {};
              subScore.name = key;
              subScore.score = s[key];

              scoreContext.scores[i].subscores.push(subScore);
            }
          }
        }

        context.score = scoreContext;

        JSON.stringify(scoreContext);

        return templateManager.render_template("endoftrainingphase", context, request);
      });
    } else {
      return templateManager.render_template("endoftrainingphase", context, request); 
    }
    //request.response.end("SCORE!!!")
  });
});

/*

Funderingar

Filter 1 pre/post/training/control/
          If Pre or Post
            Filter 2 all/raw
              if Raw
                filter 3 which test
          if Training or control
            Filter 2 phase
              filter 3 all/raw
                filter 4 which raw
            Filter 2 score
            filter 2 all + id

      Only select stuff from a single user if a id is specified                


*/


function jsonMatrixDataToCsv(json, groupby) {

  var data = [];
  var sep =";";

  var csvData = "";

  for (var ik = 0; ik < json.length; ik++) {
    if (typeof json[ik].data.rows !== "undefined") {
      data.push(json[ik]);
    }
  }

  for (var i = 0; i < data.length; i++) {
    var element = data[i];
    var keys = {};

    csvData += groupby+ ": " + sep +  element[groupby] + sep + "\n";
    //console.log("RawData number of rows: " + element.data.rows.length);
    var rowCount = element.data.rows.length;
    for (var j = 0; j < element.data.rows.length; j++) {
      var row = element.data.rows[j];
      for (var rkey in row) {
        if (keys.hasOwnProperty(rkey)) {
          keys[rkey][j] = JSON.stringify(row[rkey]);
        }else {
          keys[rkey] = [];
          keys[rkey][j] = JSON.stringify(row[rkey]);
        }
      }
    }

    var csv = "";
    var lastK = "";
    
    //Building headers
    for(var k in keys) {
      csv += k + sep;
      lastK = k;
    }

    //console.log(csv + "\n");
    csv += "\n";
    
    /*
      Skriver ut resultatet till csv:n
    */
    for (var ij = 0; ij < rowCount; ij++) {
      for(var k in keys) {
        if ( keys[k][ij] !== undefined) {
          csv += keys[k][ij] + sep;
          
        } else{
          csv += sep;
        }
      }
      csv += "\n"; 
    }

    csvData += csv;

    return csvData

  }
}


function jsonRowDataToCsv(json, groupby) {

  var users = {};

  var command = "single";

  var headers = {}

  var idField = groupby;

  console.log("jsonlen = " + json.length);

  for (var i = 0; i < json.length; i++) {

    var item = json[i];
    var id = item[idField];

    if (typeof users[id] === "undefined") {
      users[id] = {};
      console.log("new user");
    } 

    var data = null;

    if (typeof item.data != "undefined") {
      if (command === "single") {
        console.log("Data is signle");
        data = item.data.single;
      }

      // No single or raw object -> form
      if (typeof item.data.single == "undefined") {
      console.log("Data is form")  
        data = item.data;
      }
    }


    users[id]["timestamp_" + item.phase] = item.timestamp;
    headers["timestamp_" + item.phase] = "";

    for (var datapoint in data) {
      var dataheader = datapoint + " phase" +item.phase;
      users[id][dataheader] = data[datapoint];
      headers[dataheader] = "";

      console.log(datapoint + " --- " + data[datapoint]);
    }
  }

  headers[groupby] = "";

  console.log(JSON.stringify(users));

  var resArr = [];

  for (var id in users) {
    users[id][groupby] = id;
    resArr.push(users[id]);
  } 

  resArr.unshift(headers);

  var csv = babyparser.unparse(resArr, {"delimiter":";"});

  return csv;

}


router.get("/training/:id/loaddata", requireAdmin, function(request) {
  var id = request.params().get('id');
  var userid = request.params().get("userid");
  var filter1 = request.params().get("f1");
  var filter2 = request.params().get("f2");
  var filter3 = request.params().get("f3");
  var filter4 = request.params().get("f4");
  var offest = request.params().get("offset");
  var limit = request.params().get("limit");

  var matcher = {};
  var projection = {};

  console.log("filter1 " + filter1);
  console.log("filter2 " + filter2);
  console.log("filter3 " + filter3);
  console.log("filter4 " + filter4);

  matcher.trainingId = id;
  matcher.mode = filter1;

  var command = "single";
  var groupby = "userId";

  if (matcher.mode === "pre" || matcher.mode === "post") {
    /*
      Pre or post, fetch either raw or single data for all users. 
    */
    if (filter2 === "raw") {
      matcher.phase = filter3 - 1;
      projection['data.single'] = 0;
      command = "raw"
    }

    if (filter2 === "single") {
      projection['data.rows'] = 0;
    }

   // matcher.type = {$not:"generel"};
  }

  if (matcher.mode === "training") {

    matcher.userId = filter2;
    groupby = "trainingIteration";

    // Certain training phase
    if (filter3 === "single") {
      projection['data.rows'] = 0;
    }

    if (filter3 === "raw") {
      matcher.trainingIteration = parseInt(filter4 - 1);

      command = "raw"

      projection['data.single']= 0;
    }
    
    //matcher.type = "{$in:['form','test']}";
    //matcher.type = {$not:"generel"};

  }

  matcher.type = {"$ne":"general"};

  console.log(JSON.stringify(matcher));

  //throw new Error("ERRRORRRRRR");
  //var a = 1/0;

  trainingDataDAO.rawQuery(matcher, function(res) {

    var csv = "";

    if (command == "single") {
      csv = jsonRowDataToCsv(res, groupby);
    }
    if (command == "raw") {
      csv = jsonMatrixDataToCsv(res, groupby);
    }

    console.log("AllDone");
    console.log(csv);

    request.response.putHeader("Content-Type", "text/csv; charset=utf-8");
    request.response.putHeader("Content-Disposition", "attachment; filename=data.csv");

    request.response.end(csv);
    //request.response.end("\ufeff " + phaseNames + "\n" + csv);
  }, {keys:projection});

});


//Pre test
router.get("/training/:id/pre", function(request) {

});

//Post test
router.get("/training/:id/post", function(request) {

});

//Repeated training task 
router.get("/training/:id/task", function(request) {

});

router.get("/training/:id/edit", function(request) {

  templateManager.render_template('trainingEdit', {}, request);

});

//JSON structure
/*
{
  pre:[],
  post[],
  training[]
}
*/

router.post("/training/:id/edit", requireAdmin,function(request) {
  var id = request.params().get('id');
  var data = new vertx.Buffer();

  request.dataHandler(function(buffer){
    data.appendBuffer(buffer);
  });

  request.endHandler(function() {
    var dataObj = JSON.parse(data.getString(0, data.length()));
    trainingDAO.get(id, function(training) {

      training = merge_options(training, dataObj);

      training.buildIsRandom();

      training.save(function() {
        request.response.end(200);
      });
    });
  });
});

router.post("/training/:id/addform", requireAdmin,function(request) {
  var id = request.params().get('id');

  var newForm = new formModel();

  newForm.saveAndRender(function(status) {

      trainingDAO.get(id, function(training) {

        training.components.training.push({"type":"form", "name": "Unamed Form", "id":newForm.id});

        training.save(function(stat) {
          request.response.putHeader("Content-Type", "application/json; charset=UTF-8");
          request.response.end(JSON.stringify({"id":newForm.id}));
        });
      });
  });
});

router.get("/training/:id/useroverview", function(request) {
  var id = request.params().get('id');

  trainingDAO.get(id, function(training) {
    
    trainingDataDAO.list({type:"general", trainingId:id}, function(data) {

      var response = {
        training:training.toJson(),
        participants:(data.map(function(obj){return obj.toJson();}))
      };

      console.log(JSON.stringify(response.participants))

      request.response.putHeader("Content-Type", "application/json; charset=UTF-8");
      request.response.end(JSON.stringify(response));
    });
  });
});


router.get("/training/:id/json", function(request) {
  var id = request.params().get('id');

  trainingDAO.get(id, function(training) {
    var js = training.toJson();

    request.response.putHeader("Content-Type", "application/json; charset=UTF-8");
    request.response.end(js);
  });
});