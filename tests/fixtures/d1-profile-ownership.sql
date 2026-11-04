-- TEST ONLY: deterministic synthetic account for isolated local Worker auth tests.
-- Credentials are non-production and exist only in ephemeral CI D1.

INSERT INTO users (id,role,email,first_name,last_name,phone,status,password_hash)
VALUES ('ci-auth-user-2','client','ci.auth2@prochelia.test','CI2','Client','+33123456780','active','Th3GZcmPMDf9bqePfz_C6UN45CQaUnqJuba-07Xl_jw'),
       ('ci-provider-1','intervenant','ci.provider@prochelia.test','CI','Provider','+33123456781','active','Th3GZcmPMDf9bqePfz_C6UN45CQaUnqJuba-07Xl_jw'),
       ('ci-provider-2','intervenant','ci.provider2@prochelia.test','CI2','Provider','+33123456782','active','Th3GZcmPMDf9bqePfz_C6UN45CQaUnqJuba-07Xl_jw'),
       ('ci-manager-1','gerante','ci.manager@prochelia.test','CI','Manager','+33123456783','active','Th3GZcmPMDf9bqePfz_C6UN45CQaUnqJuba-07Xl_jw');
INSERT INTO clients (id,user_id,city) VALUES ('ci-client-profile-1','ci-auth-user','TestCity'),('ci-client-profile-2','ci-auth-user-2','OtherCity');
INSERT INTO intervenants (id,user_id,professional_status,description,service_area,hourly_rate,validation_status)
VALUES ('ci-provider-profile-1','ci-provider-1','micro','Synthetic test provider','TestCity',20,'pending'),
       ('ci-provider-profile-2','ci-provider-2','micro','Other synthetic provider','OtherCity',25,'pending');
