const admin = require("firebase-admin");
const { v1: uuidv1 } = require("uuid");
module.exports = class RealtimeDatabase {
    constructor(credentials, databaseURL, timeZone, queryClusterType) {
        admin.initializeApp({
            credential: admin.credential.cert(credentials),
            databaseURL: databaseURL,
          });
          this._timeZone = timeZone;
          this._queryClusterType = queryClusterType;
        this.admin = admin;
        this.db = this.admin.database();
      }

      async authorize({email, ipaddress, deviceDetails, location}){
        const user = await this._getSessionByEmail(email);
        if (user){
          return {
            message: "user found",
            sessionId: user.sessionId,
          }
        } else{
          return this._createUserSession({email, ipaddress, deviceDetails, location})
  
        }
      }

      saveQuery(sessionId, res) {
        let data = {
          sessionId: sessionId,
          query: res.queryResult.queryText,
          dateTime: new Date().toLocaleString('en-US', {
            timeZone: this._timeZone
          }),
          action: res.queryResult.action,
          responseName: res.queryResult.intent.displayName,
        }
        
        this.db.ref("queryList/" +this._savePath(this._queryClusterType)).push(data)
    }




    getRealtimeData(tableName){
      return this._getDataExtension(tableName);
    }

    async getSessionKey(sessionId) {
      const snapshot = await this._getDataExtension("sessionkey");
      for (const i in snapshot) {
        if (snapshot[i].sessionId == sessionId) {
            return snapshot[i].key;
        }
      }
    }
  
    async getSession(sessionId) {

      const snapshot = await this._getDataExtension("session");
        for (const i in snapshot) {
          if (snapshot[i].sessionId == sessionId) {
            return new Session(snapshot[i])
          }
        }
    }

    async saveSession(sessionId, session) {
      const sessionKey =  await this.getSessionKey(sessionId);
      let userSession = this.db.ref("session/" + sessionKey);
  
      userSession.update(session);
      console.log('\x1b[36m%s\x1b[0m', `Session saved! - {${sessionId}}`) 
      }



    async _getDataExtension(tableName){
      const tableData = await this.db.ref(tableName).once("value", (snapshot) => {
          let data = snapshot.val();
          return data;
      })
      return tableData.val();
    }

    async _getSessionByEmail(email){
      const snapshot = await this._getDataExtension("sessionkey");
      for (const i in snapshot) {
        if (snapshot[i].email == email) {
            return snapshot[i];
        }
      }
      return null
    }


    async _createUserSession({email, ipaddress, deviceDetails, location, name=''}){
      const sessionId = uuidv1();

      var users = this.db.ref("session");
      var newuser = users.push();
      newuser.set(new Session({
        sessionId: sessionId,
        step: 0,
        sections: ["introduction", "worktools", "policies"],
        currentsection: "",
        topics: "",
        currenttopic: "",
        tour: "pending",
        name: name,
        email: email,
      }));
      var postId = newuser.key;
      this.db.ref("sessionkey").push({
        sessionId: sessionId,
        key: postId,
        email: email,
        ipaddress: ipaddress,
        deviceDetails: deviceDetails,
        location: location,
        dataJoined: new Date().toLocaleString('en-US', {
          timeZone: this._timeZone
        }),
      });
     
      return {
        message: "user created",
        sessionId: sessionId,
      }

    }

    _savePath(queryClusterType='weekly'){
      Date.prototype.getWeek = function () {
        var onejan = new Date(this.getFullYear(), 0, 1);
        var today = new Date(this.getFullYear(), this.getMonth(), this.getDate());
        var dayOfYear = (today - onejan + 86400000) / 86400000;
        return Math.ceil(dayOfYear / 7);
      };

      let current ={
        day: new Date().getDate(),
        week: new Date().getWeek(),
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
      } 
     switch (queryClusterType ? queryClusterType.toLowerCase() : queryClusterType) {
      case 'daily':
        return `Year-${current.year}/Month-${current.month}/Day-${current.day}`;
      case 'weekly':
        return `Year-${current.year}/Week-${current.week}`;
      case 'monthly':
        return `Year-${current.year}/Month-${current.month}`;
      case 'yearly':
        return `Year-${current.year}`;
      default:
        return `Year-${current.year}/Month-${current.month}`;
     }
    }


}


class Session {
  constructor(data){
    this.step = data.step;
    this.sections = data.sections;
    this.currentsection = data.currentsection;
    this.topics = data.topics;
    this.currenttopic = data.currenttopic;
    this.sessionId = data.sessionId
    this.tour = data.tour;
    this.name = data.name;
    return this
  }
}




//  authorize 
// {name, email, sessionId, ipAddress, location}
// get sessionId by email
//     if exists return sessionId
//     else create user and return sessionId
