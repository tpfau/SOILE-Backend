package fi.abo.kogni.soile2.project.participant.impl;

import fi.abo.kogni.soile2.project.instance.ProjectInstance;
import fi.abo.kogni.soile2.project.participant.Participant;
import fi.abo.kogni.soile2.project.participant.ParticipantFactory;
import fi.abo.kogni.soile2.project.participant.ParticipantManager;
import io.vertx.core.json.JsonObject;
/**
 * A Class to generate Participants with a link to the Participant Manager that stores them.
 * @author Thomas Pfau
 *
 */
public class DBParticipantFactory implements ParticipantFactory{

	ParticipantManager manager;
	
	public DBParticipantFactory(ParticipantManager manager)
	{
		this.manager = manager;
	}
	
	@Override
	public Participant createParticipant(JsonObject data, ProjectInstance p) {
		// TODO Auto-generated method stub
		return new DBParticipant(data, p, manager);
	}
	
}
