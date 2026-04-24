import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Company } from "./Company.entity";

@Entity("license_records")
export class LicenseRecord {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  companyId!: string;

  @Column()
  licenseType!: string;

  @Column("int", { default: 1 })
  quantity!: number;

  @Column({ type: "varchar", nullable: true })
  hwid!: string | null;

  @Column({ type: "timestamp" })
  validUntil!: Date;

  @Column({ type: "text", nullable: true })
  encryptedToken!: string | null;

  @CreateDateColumn()
  generatedAt!: Date;

  @ManyToOne(() => Company, (company) => company.licenses, { onDelete: "CASCADE" })
  @JoinColumn({ name: "companyId" })
  company!: Company;
}
