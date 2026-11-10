import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
@Index('users_nickname_lower_unique', { synchronize: false })
@Index('users_email_lower_unique', { synchronize: false })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  nickname!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash!: string;

  @Column({ type: 'date', nullable: true })
  birthdate!: string | null;

  @Column({
    name: 'profile_picture',
    type: 'text',
    nullable: true,
  })
  profilePicture!: string | null;

  @Column({ type: 'text', nullable: true })
  banner!: string | null;

  @Column({ type: 'text', nullable: true })
  biography!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt!: Date;
}
