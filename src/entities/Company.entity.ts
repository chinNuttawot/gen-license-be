import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { LicenseRecord } from "./LicenseRecord.entity";

@Entity("companies")
export class Company {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  name!: string;

  @Column({ nullable: true })
  contactName!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @OneToMany(() => LicenseRecord, (license) => license.company)
  licenses!: LicenseRecord[];
}
