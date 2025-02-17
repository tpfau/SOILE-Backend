package fi.abo.kogni.soile2.project.instance.impl;

import fi.abo.kogni.soile2.project.instance.ProjectFactory;
import fi.abo.kogni.soile2.project.instance.ProjectInstance;
import io.vertx.core.eventbus.EventBus;
import io.vertx.ext.mongo.MongoClient;

public class DBProjectFactory implements ProjectFactory {

	protected MongoClient client;
	protected String projectInstanceDB;
	protected EventBus eb;
	/**
	 * Default constructor
	 * @param client
	 * @param projectInstanceDB
	 */
	public DBProjectFactory(MongoClient client, String projectInstanceDB, EventBus eb) {
		super();
		this.client = client;
		this.projectInstanceDB = projectInstanceDB;
		this.eb = eb;
	}

	@Override
	public ProjectInstance createInstance() {
		// TODO Auto-generated method stub
		return new DBProject(client, projectInstanceDB, eb);
	}

}
