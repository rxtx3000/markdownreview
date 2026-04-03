/*
  Warnings:

  - Added the required column `version_number` to the `document_versions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "document_versions" ADD COLUMN     "version_number" INTEGER NOT NULL;
