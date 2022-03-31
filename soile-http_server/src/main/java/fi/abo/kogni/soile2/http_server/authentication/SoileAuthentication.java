package fi.abo.kogni.soile2.http_server.authentication;

import java.util.List;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import fi.abo.kogni.soile2.http_server.SoilePermissionVerticle;
import fi.abo.kogni.soile2.http_server.userManagement.SoileHashing;
import fi.abo.kogni.soile2.http_server.userManagement.exceptions.DuplicateUserEntryInDBException;
import fi.abo.kogni.soile2.http_server.userManagement.exceptions.InvalidLoginException;
import fi.abo.kogni.soile2.utils.SoileCommUtils;
import fi.abo.kogni.soile2.utils.SoileConfigLoader;
import io.vertx.core.AsyncResult;
import io.vertx.core.Future;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.auth.HashingStrategy;
import io.vertx.ext.auth.User;
import io.vertx.ext.auth.authentication.AuthenticationProvider;
import io.vertx.ext.mongo.MongoClient;

/**
 * This Verticle will handle User Authentication 
 * @author thomas
 *
 */
public class SoileAuthentication implements AuthenticationProvider{

	private final MongoClient client;
	private final HashingStrategy strategy;
	
	static final Logger LOGGER = LogManager.getLogger(SoileAuthentication.class);
	public SoileAuthentication(MongoClient client)
	{		
		this.client = client;
		strategy = new SoileHashing(SoileConfigLoader.getUserProperty("serverSalt"));
	}
	
	
	
	@Override
	public void authenticate(JsonObject credentials, Handler<AsyncResult<User>> resultHandler) 
	{
		System.out.println("Trying to authenticate");
		   try {
			      //no credentials provided
			      if (credentials == null || credentials.getString("username") == null ) {
			    	
			        resultHandler.handle((Future.failedFuture("Invalid Credentials.")));
			        return;
			      }
			      if (credentials.getString(SoileConfigLoader.getdbField("passwordField")) == null 
			    	  ||credentials.getString(SoileConfigLoader.getdbField("passwordField")).isEmpty())
			    	  
			      {
			    	  resultHandler.handle((Future.failedFuture("Invalid Password.")));
				      return;  
			      }
			      LOGGER.debug("requesting user entry from database");
			      String username = credentials.getString("username");
			      UserUtils.getUserDataFromCollection(client, username , res ->
			      {
			    	if(res.succeeded())
			    	{
			    		try
			    		{
			    			User user = getUser(res.result(),credentials);
			    			resultHandler.handle(Future.succeededFuture(user));
			    		}
			    		catch(InvalidLoginException e)
			    		{
			    			resultHandler.handle(Future.failedFuture(e));
			    		}
			    	}			    	
			    	else
			    	{
			    		if(res.cause() instanceof DuplicateUserEntryInDBException)
			    		{
			    			LOGGER.error("Found a duplicate user in database: " + username);
			    			resultHandler.handle(Future.failedFuture("Internal Server Error"));
			    		}
			    		else
			    		{
			    			resultHandler.handle(Future.failedFuture(res.cause()));	
			    		}
			    	}
			      });
			      			      
			    } catch (RuntimeException e) {
			      resultHandler.handle(Future.failedFuture(e));
			      return;
			    }	
	}

	public User getUser(JsonObject dbEntry, JsonObject credentials)
		      throws InvalidLoginException {
    	String username = credentials.getString(SoileConfigLoader.getdbField("usernameField"));
		User user = UserUtils.buildUserForDBEntry(dbEntry,username);		
	    if(strategy.verify(dbEntry.getString(SoileConfigLoader.getdbField("passwordField")),
	    		credentials.getString(SoileConfigLoader.getSessionProperty("passwordField"))))
	    {
	    	//User authenticated!!
	    	LOGGER.debug("Successfully validated the user");
	    	return user;
	    }
	    else
	    {
	    	LOGGER.debug("Could not validate user with the following Credentials:\n " + credentials.encodePrettily());
	    	throw new InvalidLoginException(username);
	    }

	}	
}
