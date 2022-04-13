package fi.abo.kogni.soile2.http_server;

import java.util.LinkedList;
import java.util.List;

import fi.abo.kogni.soile2.utils.SoileConfigLoader;
import io.vertx.config.ConfigRetriever;
import io.vertx.core.AbstractVerticle;
import io.vertx.core.CompositeFuture;
import io.vertx.core.DeploymentOptions;
import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.http.HttpServer;
import io.vertx.core.http.HttpServerOptions;
import io.vertx.core.json.JsonObject;
import io.vertx.core.net.JksOptions;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.handler.SessionHandler;
import io.vertx.ext.web.sstore.LocalSessionStore;
import io.vertx.ext.web.sstore.SessionStore;

public class SoileServerVerticle extends AbstractVerticle {
	
	private JsonObject soileConfig = new JsonObject();
	private Router router;
	private SessionStore store;
	@Override
	public void start(Promise<Void> startPromise) throws Exception {
	
		getConfig()
		.compose(this::storeConfig)
		.compose(this::setUpRouting)		
		.compose(this::deployVerticles)
		.compose(this::startHttpServer).onComplete(res ->
		{
			if(res.succeeded())
			{
				System.out.println("Server started successfully");
				startPromise.complete();
			}
			else
			{
				System.out.println("Error starting server " + res.cause().getMessage());
				res.cause().printStackTrace(System.out);
				startPromise.fail(res.cause().getMessage());
			}
		});
	}
	
	Future<Void> deployVerticles(Void unused)
	{
		DeploymentOptions opts = new DeploymentOptions().setConfig(soileConfig);
		List<Future> deploymentFutures = new LinkedList();
		deploymentFutures.add(Future.<String>future(promise -> vertx.deployVerticle(new SoileUserManagementVerticle(), opts, promise)));
		deploymentFutures.add(Future.<String>future(promise -> vertx.deployVerticle(new SoilePermissionVerticle(), opts, promise)));				
		deploymentFutures.add(Future.<String>future(promise -> vertx.deployVerticle(new SoileAuthenticationVerticle(router,store), opts, promise)));
		return CompositeFuture.all(deploymentFutures).mapEmpty();
	}
	
	Future<Void> storeConfig(JsonObject configLoadResult)
	{
		soileConfig.mergeIn(configLoadResult);
		return SoileConfigLoader.setConfigs(configLoadResult);		
	}
	
	Future<JsonObject> getConfig()
	{
		ConfigRetriever cfgRetriever = SoileConfigLoader.getRetriever(vertx);		
		return Future.future( promise -> cfgRetriever.getConfig(promise));
	}
	Future<Void> setUpRouting(Void unused)
	{
		store = LocalSessionStore.create(vertx);
		SessionHandler shandler = SessionHandler.create(store);
		router = Router.router(vertx);
		return Future.<Void>succeededFuture();
	}

	
	Future<Void> startHttpServer(Void unused)
	{
		 JksOptions keyOptions = new JksOptions()
		    .setPath("server-keystore.jks")
		    .setPassword("secret");		    

		    
		JsonObject http_config = soileConfig.getJsonObject("http_server");
		HttpServerOptions opts = new HttpServerOptions()
									 .setLogActivity(true) 
									 .setSsl(true)
									 .setKeyStoreOptions(keyOptions);
		HttpServer server = vertx.createHttpServer(opts).requestHandler(router);
		int httpPort = http_config.getInteger("port", 8080);
				
		return Future.<HttpServer>future(promise -> server.listen(httpPort,promise)).mapEmpty();	
	}
}
