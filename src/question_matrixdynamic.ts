﻿/// <reference path="question.ts" />
/// <reference path="questionfactory.ts" />
/// <reference path="jsonobject.ts" />
/// <reference path="question_matrixdropdownbase.ts" />

module Survey {
    export class MatrixDynamicRowModel extends MatrixDropdownRowModelBase {
        constructor(public index: number, data: IMatrixDropdownData, value: any) {
            super(data, value);
        }
        public get rowName() { return "row" + this.index; }
    }
    export class QuestionMatrixDynamicModel extends QuestionMatrixDropdownModelBase implements IMatrixDropdownData {
        static MaxRowCount = 100;
        private rowCounter = 0;
        private rowCountValue: number = 2;
        constructor(public name: string) {
            super(name);
        }
        public getType(): string {
            return "matrixdynamic";
        }
        public get rowCount() { return this.rowCountValue; }
        public set rowCount(val: number) {
            if (val < 0 || val > QuestionMatrixDynamicModel.MaxRowCount) return;
            this.rowCountValue = val;
        }
        public addRow() {
            this.rowCount++;
        }
        public removeRow(index: number) {
            if (index < 0 || index >= this.rowCount) return;
            if (this.value) {
                var val = this.createNewValue(this.value);
                val.splice(index, 1);
                val = this.deleteRowValue(val, null);
                this.value = val;
            }
            this.rowCount--;
        }
        protected generateRows(): Array<MatrixDynamicRowModel> {
            var result = new Array<MatrixDynamicRowModel>();
            if (this.rowCount === 0) return result;
            var val = this.createNewValue(this.value);
            for (var i = 0; i < this.rowCount; i++) {
                result.push(this.createMatrixRow(this.getRowValueByIndex(val, i)));
            }
            return result;
        }
        protected createMatrixRow(value: any): MatrixDynamicRowModel {
            return new MatrixDynamicRowModel(this.rowCounter ++, this, value);
        }
        protected createNewValue(curValue: any): any {
            var result = curValue;
            if (!result) result = [];
            var r = [];
            if (result.length > this.rowCount) result.splice(this.rowCount - 1);
            for (var i = result.length; i < this.rowCount; i++) {
                result.push({});
            }
            return result;
        }
        protected deleteRowValue(newValue: any, row: MatrixDropdownRowModelBase): any {
            var isEmpty = true;
            for (var i = 0; i < newValue.length; i++) {
                if (Object.keys(newValue[i]).length > 0) {
                    isEmpty = false;
                    break;
                }
            }
            return isEmpty ? null : newValue;
        }

        private getRowValueByIndex(questionValue: any, index: number): any {
            return index >= 0 && index < questionValue.length ? questionValue[index] : null;
        }
        protected getRowValue(row: MatrixDropdownRowModelBase, questionValue: any, create: boolean = false): any {
            return this.getRowValueByIndex(questionValue, this.generatedVisibleRows.indexOf(row));
        }
    }

    JsonObject.metaData.addClass("matrixdynamic", ["rowCount:number"], function () { return new QuestionMatrixDynamicModel(""); }, "matrixdropdownbase");
    JsonObject.metaData.setPropertyValues("matrixdynamic", "rows", null, 2);
    QuestionFactory.Instance.registerQuestion("matrixdynamic", (name) => { var q = new QuestionMatrixDynamicModel(name); q.choices = [1, 2, 3, 4, 5]; q.addColumn("Column 1"); q.addColumn("Column 2"); q.addColumn("Column 3"); return q; });
}