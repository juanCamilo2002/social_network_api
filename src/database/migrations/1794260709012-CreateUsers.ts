import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1794260709012 implements MigrationInterface {
  name = 'CreateUsers1794260709012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nickname" character varying(50) NOT NULL, "name" character varying(100) NOT NULL, "last_name" character varying(100) NOT NULL, "email" character varying(254) NOT NULL, "password_hash" character varying(255) NOT NULL, "birthdate" date, "profile_picture" text, "banner" text, "biography" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`
            CREATE UNIQUE INDEX "users_nickname_lower_unique"
            ON "users" (LOWER("nickname"))
        `);

    await queryRunner.query(`
            CREATE UNIQUE INDEX "users_email_lower_unique"
            ON "users" (LOWER("email"))
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "users_email_lower_unique"
        `);

    await queryRunner.query(`
            DROP INDEX "users_nickname_lower_unique"
        `);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
