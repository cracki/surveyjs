﻿import {JsonObject} from './jsonobject';
import {QuestionBase} from './questionbase';
import {Base, SurveyError, SurveyElement, HashTable} from "./base";
import {surveyLocalization} from "./surveyStrings";
import {AnswerRequiredError} from "./error";
import {SurveyValidator, IValidatorOwner, ValidatorRunner} from "./validator";
import {TextPreProcessor} from "./textPreProcessor";
import {ILocalizableOwner, LocalizableString} from "./localizablestring";
import {ConditionRunner} from './conditions';

/**
 * Extends question base class with title, value, errors and other functionality
 */
export class Question extends QuestionBase implements IValidatorOwner {
    private locTitleValue: LocalizableString;
    private locDescriptionValue: LocalizableString;
    private locCommentTextValue: LocalizableString;
    private locRequiredErrorTextValue: LocalizableString;
    private questionValue: any;
    private questionComment: string;
    private isRequiredValue: boolean = false;
    private hasCommentValue: boolean = false;
    private hasOtherValue: boolean = false;
    private readOnlyValue: boolean = false;
    private textPreProcessor: TextPreProcessor;
    private conditionEnabelRunner: ConditionRunner;
    errors: Array<SurveyError> = [];
    validators: Array<SurveyValidator> = new Array<SurveyValidator>();
    valueChangedCallback: () => void;
    commentChangedCallback: () => void;
    errorsChangedCallback: () => void;
    titleChangedCallback: () => void;
    validateValueCallback: () => SurveyError;
    /**
     * An expression that returns true or false. If it returns false the Question becomes read only and an end-user will not able to answer on the qustion. The library runs the expression on survey start and on changing a question value. If the property is empty then readOnly property is used.
     * @see readOnly
     * @see isReadOnly
     */
    public enableIf: string = "";

    constructor(public name: string) {
        super(name);
        var self = this;
        this.locTitleValue = new LocalizableString(this, true);
        this.locTitleValue.onRenderedHtmlCallback = function(text) { return self.fullTitle; };
        this.locDescriptionValue = new LocalizableString(this, true);
        this.locDescriptionValue.onRenderedHtmlCallback = function(html) { return self.getProcessedHtml(html); }
        this.locCommentTextValue = new LocalizableString(this, true);
        this.locRequiredErrorTextValue = new LocalizableString(this);
    }
    public get hasTitle(): boolean { return true; }
    public get hasDescription(): boolean { return this.description != ""; }
    public get titleLocation() : string { return this.survey ? this.survey.questionTitleLocation : "top"; }
    public get errorLocation() : string { return this.survey ? this.survey.questionErrorLocation : "top"; }
    public get hasInput(): boolean { return true; }
    public get inputId(): string { return this.id + "i"; }
    /** 
     * Question title. Use survey questionTitleTemplate property to change the title question is rendered. If it is empty, then question name property is used.
     * @see SurveyModel.questionTitleTemplate
    */
    public get title(): string {
        var res = this.locTitle.text;
        return res ? res : this.name;
    }
    public set title(newValue: string) {
        this.locTitle.text = newValue;
        this.fireCallback(this.titleChangedCallback);
    }
    get locTitle(): LocalizableString { return this.locTitleValue; }
    /**
     * Question description. It renders under question title by using smaller font. Unlike the title, description can be empty.
     * @see title
     */
    public get description(): string { return this.locDescription.text ? this.locDescription.text : ""; }
    public set description(newValue:  string) { this.locDescription.text = newValue; }
    get locDescription(): LocalizableString { return this.locDescriptionValue; }
    /**
     * The custom text that will be shown on required error. Use this property, if you do not want to show the default text.
     */
    public get requiredErrorText(): string { return this.locRequiredErrorText.text ? this.locRequiredErrorText.text : ""; }
    public set requiredErrorText(newValue: string) { this.locRequiredErrorText.text = newValue; }
    get locRequiredErrorText(): LocalizableString { return this.locRequiredErrorTextValue; }
    get locCommentText(): LocalizableString { return this.locCommentTextValue; }
    private get locTitleHtml(): string {
        var res = this.locTitle.textOrHtml;
        return res? res: this.name;
    }
    /**
     * Returns a copy of question errors survey. For some questions like matrix and panel dynamic it includes the errors of nested questions.
     */
    public getAllErrors(): Array<SurveyError> { return this.errors.slice(); }
    public onLocaleChanged() {
        super.onLocaleChanged();
        this.locTitle.onChanged();
        this.locCommentText.onChanged();
    }
    protected getProcessedHtml(html: string): string {
        if(!html || !this.textProcessor) return html;
        return this.textProcessor.processText(html, true);
    }
    /**
     * Returns the rendred question title.
     */
    public get processedTitle() { return this.getProcessedHtml(this.locTitleHtml); }
    /**
     * Returns the title after processing the question template.
     * @see SurveyModel.questionTitleTemplate
     */
    public get fullTitle(): string {
        if (this.survey && this.survey.getQuestionTitleTemplate()) {
            if (!this.textPreProcessor) {
                var self = this;
                this.textPreProcessor = new TextPreProcessor();
                this.textPreProcessor.onHasValue = function (name: string) { return self.canProcessedTextValues(name.toLowerCase()); };
                this.textPreProcessor.onProcess = function (name: string) { return self.getProcessedTextValue(name); };
            }
            return this.textPreProcessor.process(this.survey.getQuestionTitleTemplate());
        }
        var requireText = this.requiredText;
        if (requireText) requireText += " ";
        var no = this.no;
        if (no) no += ". ";
        return no + requireText + this.processedTitle;
    }
    public focus(onError: boolean = false) {
        SurveyElement.ScrollElementToTop(this.id);
        var id = !onError ? this.getFirstInputElementId() : this.getFirstErrorInputElementId();
        if (SurveyElement.FocusElement(id)) {
            this.fireCallback(this.focusCallback);
        }
    }
    protected updateCssClasses(res: any, surveyCss: any) { 
        super.updateCssClasses(res, surveyCss);
        if(this.isRequired) {
            if(surveyCss.question.required) {
                res.root += " " + surveyCss.question.required;
            }
            if(surveyCss.question.titleRequired) {
                res.title += " " + surveyCss.question.titleRequired;
            }
        }
    }
    protected getFirstInputElementId(): string {
        return this.inputId;
    }
    protected getFirstErrorInputElementId(): string {
        return this.getFirstInputElementId();
    }
    protected canProcessedTextValues(name: string): boolean {
        return name == "no" || name == "title" || name == "require";
    }
    protected getProcessedTextValue(name: string): any {
        if (name == "no") return this.no;
        if (name == "title") return this.processedTitle;
        if (name == "require") return this.requiredText;
        return null;
    }
    public supportComment(): boolean { return false; }
    public supportOther(): boolean { return false; }
    /** 
     * Set this property to true, to make the question a required. If a user doesn't answer the question then a validation error will be generated.
     */
    public get isRequired(): boolean { return this.isRequiredValue; }
    public set isRequired(val: boolean) {
        if (this.isRequired == val) return;
        this.isRequiredValue = val;
        this.fireCallback(this.titleChangedCallback);
    }
    public get hasComment(): boolean { return this.hasCommentValue; }
    public set hasComment(val: boolean) {
        if (!this.supportComment()) return;
        this.hasCommentValue = val;
        if (this.hasComment) this.hasOther = false;
    }
    /** 
     * Use it to get or set the comment value.
     */
    public get commentText(): string {
        var res = this.locCommentText.text;
        return res ? res : surveyLocalization.getString("otherItemText");
    }
    public set commentText(value: string) {
        this.locCommentText.text = value;
    }
    public get hasOther(): boolean { return this.hasOtherValue; }
    public set hasOther(val: boolean) {
        if (!this.supportOther() || this.hasOther == val) return;
        this.hasOtherValue = val;
        if (this.hasOther) this.hasComment = false;
        this.hasOtherChanged();
    }
    protected hasOtherChanged() { }
    /**
     * Retuns true if readOnly property is true or survey is in display mode.
     * @see SurveyModel.model
     * @see readOnly
     */
    public get isReadOnly() { return this.readOnly || (this.survey != null && this.survey.isDisplayMode);}
    /**
     * Set it to true to make a question readonly.
     */
    /**
     * Set it to true to make the question readonly.
     */
    public get readOnly(): boolean { return this.readOnlyValue; }
    public set readOnly(value: boolean) {
        if(this.readOnly == value) return;
        this.readOnlyValue = value;
        this.onReadOnlyChanged();
    }
    public runCondition(values: HashTable<any>) {
        super.runCondition(values);
        if (!this.enableIf) return;
        if (!this.conditionEnabelRunner) this.conditionEnabelRunner = new ConditionRunner(this.enableIf);
        this.conditionEnabelRunner.expression = this.enableIf;
        this.readOnly = !this.conditionEnabelRunner.run(values);
    }
    
    onReadOnlyChanged() {
        this.fireCallback(this.readOnlyChangedCallback);
    }
    onAnyValueChanged(name: string) {
        if(!name) return;
        var titleValue = this.locTitle.text;
        if(!titleValue) return;
        if(titleValue.toLocaleLowerCase().indexOf('{' + name.toLowerCase()) > -1) {
            this.fireCallback(this.titleChangedCallback);
        }
    }
    protected get no(): string {
        if (this.visibleIndex < 0) return "";
        var startIndex = 1;
        var isNumeric = true;
        var str = "";
        if (this.survey && this.survey.questionStartIndex) {
            str = this.survey.questionStartIndex;
            if (parseInt(str)) startIndex = parseInt(str);
            else if (str.length == 1) isNumeric = false;
        }
        if (isNumeric) return (this.visibleIndex + startIndex).toString();
        return String.fromCharCode(str.charCodeAt(0) + this.visibleIndex);
    }
    protected onSetData() {
        super.onSetData();
        this.onSurveyValueChanged(this.value);
    }
    private isvalueChangedCallbackFiring: boolean = false;
    /**
     * Get/Set the question value.
     * @see SurveyMode.setValue
     * @see SurveyMode.getValue
     */
    public get value(): any {
        return this.valueFromData(this.getValueCore());
    }
    public set value(newValue: any) {
        this.setNewValue(newValue);
        if (this.isvalueChangedCallbackFiring) return;
        this.isvalueChangedCallbackFiring = true;
        this.fireCallback(this.valueChangedCallback);
        this.isvalueChangedCallbackFiring = false;
    }
    public get displayValue(): any {
        return this.value;
    }

    /**
     * The question comment value.
     */
    public get comment(): string { return this.getComment(); }
    public set comment(newValue: string) {
        if (this.comment == newValue) return;
        this.setComment(newValue);
        this.fireCallback(this.commentChangedCallback);
    }
    protected getComment(): string { return this.data != null ? this.data.getComment(this.name) : this.questionComment; }
    protected setComment(newValue: string) {
        this.setNewComment(newValue);
    }
    /**
     * Returns true if the question value is empty
     */
    public isEmpty(): boolean { return Base.isValueEmpty(this.value); }
    /**
     * Returns true if threre is a validation error(s) in the question. 
     * @param fireCallback set it to true to show an error in UI.
     */
    public hasErrors(fireCallback: boolean = true): boolean {
        this.checkForErrors(fireCallback);
        return this.errors.length > 0;
    }
    /**
     * Returns the validation errors count.
     */
    public get currentErrorCount(): number { return this.errors.length; }
    /**
     * Returns the char/string for a required question.
     * @see SurveyModel.requiredText
     */
    public get requiredText(): string { return this.survey != null && this.isRequired ? this.survey.requiredText : ""; }
    /**
     * Add error into the question error list.
     * @param error 
     */
    public addError(error: SurveyError) {
        this.errors.push(error);
        this.fireCallback(this.errorsChangedCallback);
    }
    private checkForErrors(fireCallback: boolean) {
        var errorLength = this.errors ? this.errors.length : 0;
        this.errors = [];
        this.onCheckForErrors(this.errors);
        if (this.errors.length == 0 && !this.isEmpty()) {
            var error = this.runValidators();
            if (error) {
                this.errors.push(error);
            }
        }
        if (this.survey && this.errors.length == 0) {
            var error = this.fireSurveyValidation();
            if (error) {
                this.errors.push(error);
            }
        }
        if (fireCallback && (errorLength != this.errors.length || errorLength > 0)) {
            this.fireCallback(this.errorsChangedCallback);
        }
    }
    private fireSurveyValidation(): SurveyError {
        if(this.validateValueCallback) return this.validateValueCallback();
        return this.survey ? this.survey.validateQuestion(this.name) : null;
    }
    protected onCheckForErrors(errors: Array<SurveyError>) {
        if (this.hasRequiredError()) {
            this.errors.push(new AnswerRequiredError(this.requiredErrorText));
        }
    }
    protected hasRequiredError(): boolean {
        return this.isRequired && this.isEmpty();
    }
    protected runValidators(): SurveyError {
        return new ValidatorRunner().run(this);
    }
    private isValueChangedInSurvey = false;
    protected setNewValue(newValue: any) {
        this.setNewValueInData(newValue);
        this.onValueChanged();
    }
    protected setNewValueInData(newValue: any) {
        if (!this.isValueChangedInSurvey) {
            newValue = this.valueToData(newValue);
            this.setValueCore(newValue);
        }
    }
    private getValueCore() {
        return this.data != null ? this.data.getValue(this.name) : this.questionValue;
    }
    private setValueCore(newValue: any) {
        if (this.data != null) {
            this.data.setValue(this.name, newValue);
        } else {
            this.questionValue = newValue;
        }
    }
    protected valueFromData(val: any): any { return val; }
    protected valueToData(val: any): any { return val; }
    protected onValueChanged() { }
    protected setNewComment(newValue: string) {
        if (this.data != null) {
            this.data.setComment(this.name, newValue);
        } else this.questionComment = newValue;
    }
    //IQuestion
    onSurveyValueChanged(newValue: any) {
        this.isValueChangedInSurvey = true;
        this.value = this.valueFromData(newValue);
        this.fireCallback(this.commentChangedCallback);
        this.isValueChangedInSurvey = false;
    }
    //IValidatorOwner
    getValidatorTitle(): string { return null; }
}
JsonObject.metaData.addClass("question", [{ name: "title:text", serializationProperty: "locTitle" },
    { name: "description:text", serializationProperty: "locDescription" }, 
    { name: "commentText", serializationProperty: "locCommentText" }, "enableIf:expression",
    "isRequired:boolean", { name: "requiredErrorText:text", serializationProperty: "locRequiredErrorText" },
    "readOnly:boolean", { name: "validators:validators", baseClassName: "surveyvalidator", classNamePart: "validator"}], null, "questionbase");
