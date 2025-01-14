package fi.abo.kogni.soile2.project;

import java.io.File;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import fi.aalto.scicomp.gitFs.gitProviderVerticle;
import fi.abo.kogni.soile2.project.items.GitFile;
import fi.abo.kogni.soile2.utils.SoileConfigLoader;
import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.eventbus.EventBus;
import io.vertx.core.json.JsonObject;

/**
 * This class manages access to the {@link gitProviderVerticle}s via the eventbus..
 * It only communicates with the gitProviderVerticle providing some utility functions.
 * @author Thomas Pfau
 *
 */
public class GitManager {

	EventBus eb;
	private static final Logger log = LogManager.getLogger(GitManager.class.getName());	

	public GitManager(EventBus eb)
	{
		this.eb = eb;
	}
	
	/**
	 * Test whether a repo element exists asynchronosly
	 * @param elementID the ID (Project, Task or ExperimentID)
	 * @return a Future that on success indicates whether the element exists or not. Failure means either the request was inconsistent, or something went wrong 
	 * 		   in the process, and should not be taken as non existence indication. 
	 */
	public Future<Boolean> doesRepoExist(String elementID)
	{
		Promise<Boolean> existPromise = Promise.<Boolean>promise();
		eb.request(SoileConfigLoader.getServerProperty("gitVerticleAddress"), gitProviderVerticle.createExistRepoCommand(elementID))
		.onSuccess( reply ->
		{
			existPromise.complete(((JsonObject)reply.body()).getBoolean(gitProviderVerticle.DATAFIELD));							
		})
		.onFailure(fail ->
		{
			existPromise.fail(fail);
		});
		return existPromise.future();
	}
	

	/**
	 * Get the file contents of a file in the github repository, these are all just json/linker files). 
	 * @param fileName The name of the file
	 * @param taskID The task the file belongs to 
	 * @param taskVersion the version of the file.
	 * @return A String with the contents that can normally be parsed as json.
	 */
	public Future<String> getGitFileContents(GitFile file)
	{
		Promise<String> dataPromise = Promise.<String>promise();
		eb.request(SoileConfigLoader.getServerProperty("gitVerticleAddress"), gitProviderVerticle.createGetCommand(file.getRepoID(),file.getRepoVersion(),file.getFileName()))
		.onSuccess( reply ->
		{
			dataPromise.complete(((JsonObject)reply.body()).getString(gitProviderVerticle.DATAFIELD));							
		})
		.onFailure(fail ->
		{
			dataPromise.fail(fail);
		});
		return dataPromise.future();	
	}
	
	/**
	 * Get the file contents of a file in the github repository, these are all just json/linker files). 
	 * @param fileName The name of the file
	 * @param taskID The task the file belongs to 
	 * @param taskVersion the version of the file.
	 * @return A String with the contents that can normally be parsed as json.
	 */
	public Future<String> getGitResourceContents(GitFile file)
	{
		return getGitFileContents(new GitFile("resources" + File.separator + file.getFileName(), file.getRepoID(), file.getRepoVersion()));
	}
	/**
	 * Get the file contents of a git file as a Json Object. 
	 * @return A {@link JsonObject} of the contents of the git file.
	 */
	public Future<JsonObject> getGitResourceContentsAsJson(GitFile file)
	{
		Promise<JsonObject> dataPromise = Promise.<JsonObject>promise();
		getGitResourceContents(file).onSuccess(jsonString -> {
			try 
			{
				JsonObject data = new JsonObject(jsonString);
				dataPromise.complete(data);
			}
			catch(Exception e)
			{
				dataPromise.fail(e);
			}
		}).onFailure(fail ->{
			dataPromise.fail(fail);
		});
		return dataPromise.future();
	}
	
	/**
	 * Get the file contents of a git file as a Json Object. 
	 * @return A {@link JsonObject} of the contents of the git file.
	 */
	public Future<JsonObject> getGitFileContentsAsJson(GitFile file)
	{
		Promise<JsonObject> dataPromise = Promise.<JsonObject>promise();
		getGitFileContents(file).onSuccess(stringData ->{
			try
			{
				JsonObject data = new JsonObject(stringData);
				dataPromise.complete(data);
			}
			catch(Exception e)
			{
				e.printStackTrace(System.out);
				dataPromise.fail(e);
			}
			
		}).onFailure(fail -> 
		{
			dataPromise.fail(fail);
		});	
		return dataPromise.future();			
	}

	/**
	 * Write data to a file specified by the {@link GitFile}, receive the new version of the respective file. 
	 * @param file the GitFile containing name (including folders),  
	 * @param data
	 * @return
	 */
	public Future<String> writeGitFile(GitFile file, String data)
	{
		Promise<String> versionPromise = Promise.<String>promise();
		JsonObject command = gitProviderVerticle.createWriteCommand(file.getRepoID(), file.getRepoVersion(), data, file.getFileName());
		eb.request(SoileConfigLoader.getServerProperty("gitVerticleAddress"), command).onSuccess(reply -> {
			JsonObject info = (JsonObject)reply.body();
			// return the new version of this repository (for future changes)
			versionPromise.complete(info.getString(gitProviderVerticle.COMMITHASHFIELD));
		}).onFailure(fail -> {
			versionPromise.fail(fail);
		});
		return versionPromise.future();	
	}
	
	/**
	 * Same as writeGitFile with a string, but encodes the provided Json as a pretty string.
	 * @param file the file indicating where to write to.
	 * @param data the data that should be encoded in the file
	 * @return the new version of the file.
	 */
	public Future<String> writeGitFile(GitFile file, JsonObject data)
	{
		return writeGitFile(file, data.encodePrettily());
	}
	
	/**
	 * Write data to a file specified by the {@link GitFile} in the resources folder of the repo.  
	 * @param file the GitFile containing name (including folders) but excluding the resources folder,  
	 * @param data the data to be written to the file.
	 * @return a Future with the version of the git repository after execution.
	 */
	public Future<String> writeGitResourceFile(GitFile file, String data)
	{
		return writeGitFile(new GitFile("resources" + File.separator + file.getFileName(), file.getRepoID(), file.getRepoVersion()), data);
	}
	
	/**
	 * Same as writeGitFile with a string, but encodes the provided Json as a pretty string.
	 * @param file the file indicating where to write to.
	 * @param data the data that should be encoded in the file
	 * @return the new version of the file.
	 */
	public Future<String> writeGitResourceFile(GitFile file, JsonObject data)
	{
		return writeGitResourceFile(file, data.encodePrettily());
	}
	
}
