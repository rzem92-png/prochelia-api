-- TEST ONLY: deterministic synthetic account for isolated local Worker auth tests.
-- Credentials are non-production and exist only in ephemeral CI D1.
INSERT INTO users (id,role,email,first_name,last_name,phone,status,password_hash)
VALUES ('ci-auth-user','client','ci.auth@prochelia.test','CI','Client','+33123456789','active','pbkdf2$100000$YXV0aC10ZXN0LXNhbHQ$Th3GZcmPMDf9bqePfz_C6UN45CQaUnqJuba-07Xl_jw');
