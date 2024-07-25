sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v2/ODataModel",
    "../utils/DateFormatter",
    "../utils/NumberFormatter",
    "sap/btp/wizard3/controller/BaseController",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (JSONModel, ODataModel, DateFormatter, NumberFormatter, 
               BaseController, Fragment, MessageBox, Filter, FilterOperator) 
    {
        "use strict";

        const url_oData = "/V2/Northwind/Northwind.svc/";
        var aSelectedProducts = [];
        var currentStepIndex = 0;

        return BaseController.extend("sap.btp.wizard3.controller.View1", {
            dateFormatter: DateFormatter,
            numberFormatter : NumberFormatter,
            
            onInit: function () {
                // Creazione del modello JSON con le informazioni sulla visibilità dei pulsanti
                var oVisibilityModel = new JSONModel({
                    nextButtonVisible: true, // Impostato inizialmente su true se desideri visualizzarlo
                    confirmButtonVisible: false
                });
                
                this.getView().setModel(oVisibilityModel, "visibilityModel"); // Assegna il modello alla vista
            },

            onValueHelp: async function() {
                if(!this._oDialog) 
                {
                    this._oDialog = sap.ui.xmlfragment("valueHelpSearchEmployeer", "sap.btp.wizard.view.fragment.ValueHelpSearchEmployeer", this);
                    this.getView().addDependent(this._oDialog);

                    try {
                        var oModel = new ODataModel(url_oData);
                        var oData = await this.fetchDataFromOData("Employees", oModel, null, null);

                        this.getView().setModel(new JSONModel(oData.results), "employeesTableModel");
                    } catch(error) {
                        console.error("Errore nel recuperare i dati: ", error);
                    }

                    this._oDialog.open();
                } 
                else 
                {
                    this._oDialog.open();
                }
            },
            
            onCloseFragment: function() {
                this._oDialog.close();
                this._oDialog.destroy();
                this._oDialog = undefined;
            },

            onOKPressed: function() {
                // Ottieni l'elemento che ha generato l'evento, che dovrebbe essere la riga selezionata
                var oSelectedItem = Fragment.byId("valueHelpSearchEmployeer", "employeesTable").getSelectedItem();

                // Ottieni il binding context dell'elemento selezionato
                var oBindingContext = oSelectedItem.getBindingContext("employeesTableModel");

                // Ottieni il valore del LastName dal binding context
                var sEmployeeLastName = oBindingContext.getProperty("LastName"); 

                // Passa il valore all'input CustomerID nella View1
                var oInputEmployeeLastName = this.getView().byId("valueHelpSearchEmployeer");
                oInputEmployeeLastName.setValue(sEmployeeLastName);

                // Ottieni i valori da binding context
                var sFirstName = oBindingContext.getProperty("FirstName"); 
                var sLastName = oBindingContext.getProperty("LastName"); 
                var sHireDate = oBindingContext.getProperty("HireDate"); 
                var sTitle = oBindingContext.getProperty("Title"); 

                var oView = this.getView();

                var oTextFirstName = oView.byId("firstNameText");
                var oTextLastName = oView.byId("lastNameText");
                var oTextHireDate = oView.byId("hireDateText");
                var oTextTitle = oView.byId("titleText");

                // Imposta i valori dei campi nel frammento Step1
                oTextFirstName.setText(sFirstName);
                oTextLastName.setText(sLastName);
                oTextHireDate.setText(DateFormatter.formatDateString(sHireDate));
                oTextTitle.setText(sTitle);


                // Chiudi il dialog
                this.onCloseFragment();
            },

            onChangeInput: async function()
            {
                var sInputValue = this.byId("valueHelpSearchEmployeer").getValue();

                // Verifica se il valore dell'input è vuoto
                if (!sInputValue) {
                    // Svuota i campi di testo
                    this.getView().byId("firstNameText").setText("");
                    this.getView().byId("lastNameText").setText("");
                    this.getView().byId("hireDateText").setText("");
                    this.getView().byId("titleText").setText("");

                    // Rimuovi il modello JSON del dipendente selezionato
                    this.getView().setModel(null, "selectedEmployeeModel");

                    return; // Esci dalla funzione
                }

                var oModel = this.getView().getModel();

                oModel.read("/Employees", {
                    success: function(oData) {
                        var oEmployee = oData.results.find(function(oEmployee) {
                            return oEmployee.LastName.toLowerCase() === sInputValue.toLowerCase();
                        });

                        // Se il valore inserito è valido (corrisponde a un LastName presente nell'oggetto oData)
                        if (oEmployee) {
                            // Valorizza i campi Text nel fragment Step1 con i dati corrispondenti
                            var oView = this.getView();
                            oView.byId("firstNameText").setText(oEmployee.FirstName);
                            oView.byId("lastNameText").setText(oEmployee.LastName);
                            oView.byId("hireDateText").setText(DateFormatter.formatDateString(oEmployee.HireDate));
                            oView.byId("titleText").setText(oEmployee.Title);


                            // Creazione del modello JSON per memorizzare i dati del dipendente selezionato
                            var oEmployeeModel = new JSONModel({
                                firstName: oEmployee.FirstName,
                                lastName: oEmployee.LastName,
                                hireDate: DateFormatter.formatDateString(oEmployee.HireDate),
                                title: oEmployee.Title
                            });

                            // Imposta il modello JSON sulla vista
                            this.getView().setModel(oEmployeeModel, "selectedEmployeeModel");
                        }
                    }.bind(this),
                    error: function() {
                        // Gestisci eventuali errori di caricamento dei dati
                        MessageBox.error("Errore durante il recupero dei dati degli impiegati.");
                    }
                });
            },

            onAfterRendering: function() {
                var isFirstPanel = true;

                var oPage = this.getView().byId("Page");

                // Nascondi tutti i fragment tranne lo Step1 all'avvio della pagina
                oPage.getContent().forEach(function(panel) 
                {
                    if (!isFirstPanel) {
                        panel.setVisible(false);
                    }
                    else {
                        isFirstPanel = false; // Imposta isFirstPanel su false dopo aver gestito il primo pannello
                    }
                });
            },

            onNextStep: async function() {
                var oStepContainer = this.getView().byId("Page").getContent();
                var iSelectedIndex = currentStepIndex;
                
                // Esegui la validazione in base allo step corrente
                switch (iSelectedIndex) {
                    case 0: // Step1
                        if (!await this.validateStep1()) {
                            return; // Interrompi se la validazione fallisce
                        }
                        this.loadProducts();
                        break;
                    case 1: // Step2
                        if (!this.checkSelectedRowTable("productsTable", "Devi selezionare almeno un prodotto per proseguire")) {
                            return; // Interrompi se la validazione fallisce
                        }
                        if (!this.checkQuantityInStepInputWithRowSelected()) {
                            MessageBox.error("La quantità per la riga selezionata deve essere maggiore di zero");
                            return; // Interrompi se la quantità è zero
                        }
                        this.loadCustomers();
                        break;
                    case 2: // Step3
                        if (!this.checkSelectedRowTable("customersTable", "Devi selezionare un dipendente per proseguire")) {
                            return; // Interrompi se la validazione fallisce
                        }
                        break;
                }

                // Incrementa l'indice dello Step corrente
                currentStepIndex++;

                // Se esiste un pannello successivo e non è già visibile, lo rendi visibile
                if (currentStepIndex < oStepContainer.length && !oStepContainer[currentStepIndex].getVisible()) {
                    oStepContainer[currentStepIndex].setVisible(true);
                }

                // Aggiorna la visibilità dei pulsanti in base allo Step corrente
                this.updateButtonVisibility(currentStepIndex);
            },
            
            updateButtonVisibility: function(currentStepIndex) {
                var visibilityModel = this.getView().getModel("visibilityModel");

                switch (currentStepIndex) 
                {
                    case 0:
                        visibilityModel.setProperty("/nextButtonVisible", true);
                        visibilityModel.setProperty("/confirmButtonVisible", false);
                    break;
                    case 1:
                    case 2:
                        visibilityModel.setProperty("/nextButtonVisible", true);
                        visibilityModel.setProperty("/confirmButtonVisible", false);
                    break;
                    case 3:
                        visibilityModel.setProperty("/nextButtonVisible", false);
                        visibilityModel.setProperty("/confirmButtonVisible", true);
                    break;
                }
            },

            validateStep1: async function() {
                // Ottieni il valore inserito dall'utente nell'input valueHelpSearchEmployeer
                var sInputValue = this.byId("valueHelpSearchEmployeer").getValue();
                
                // Flag per indicare se la validazione è superata
                var isValid = true;
            
                // Se l'input è vuoto, mostra un messaggio di errore
                if (!sInputValue.trim()) 
                {
                    MessageBox.error("Il campo è obbligatorio. Si prega di inserire un valore.");
                    isValid = false; // Imposta il flag su false
                } 
                else 
                {
                    // Assumi che il modello della view contenga i dati OData
                    var oModel = new ODataModel(url_oData); 
                    
                    // Esegui la chiamata OData per ottenere i dati degli impiegati
                    var oEmployees = await this.fetchDataFromOData("Employees", oModel, null, "LastName");
                    var aEmployees = oEmployees.results; //array dell' oggetto oEmployees
                
                    // Controlla se il valore inserito dall' utente corrisponde al LastName di almeno un impiegato
                    var bValidInput = aEmployees.some(function(oEmployee) {
                        return oEmployee.LastName.toLowerCase() === sInputValue.toLowerCase();
                    });
                
                    // Se il valore inserito non è valido
                    if (!bValidInput) {
                        // Mostra una MessageBox di errore
                        MessageBox.error("Il valore inserito non è valido. Inserire un cognome valido.");
                
                        // Svuota l'input valueHelpSearchEmployeer
                        this.byId("valueHelpSearchEmployeer").setValue("");
                        isValid = false; // Imposta il flag su false
                    }
                }
            
                // Restituisci il flag di validità
                return isValid;
            },
            
            checkSelectedRowTable: function(idTable, errorMessage) {
                // Ottieni la tabella
                var oTable = this.byId(idTable);
                    
                // Flag per indicare se la validazione è superata
                var isValid = true;
            
                // Verifica se non ci sono righe selezionate nella tabella
                if (oTable.getSelectedItems().length === 0) {
                    // Mostra un messaggio di errore
                    MessageBox.error(errorMessage);
                    isValid = false; // Imposta il flag su false
                }
            
                // Restituisci il flag di validità
                return isValid;
            },

            checkQuantityInStepInputWithRowSelected: function() {
                // Verifica se una riga è stata selezionata nella tabella dei prodotti
                var oProductsTable = this.getView().byId("productsTable");
                var aSelectedItems = oProductsTable.getSelectedItems();
            
                if (aSelectedItems.length > 0) {
                    // Se una riga è stata selezionata, verifica se la quantità è zero
                    var oSelectedRow = aSelectedItems[0];
                    var aCells = oSelectedRow.getCells();
                    
                    // Trova lo StepInput nella riga
                    var oStepInput;
                    
                    aCells.some(function(oCell) {
                        if (oCell instanceof sap.m.StepInput) {
                            oStepInput = oCell;
                            return true; // interrompe l'iterazione
                        }
                    });
            
                    if (oStepInput) {
                        var fQuantity = parseFloat(oStepInput.getValue());
                        return fQuantity > 0; // Restituisce true se la quantità è maggiore di zero, altrimenti false
                    }
                }
            
                return false; // Se nessuna riga è stata selezionata o nessuno StepInput è stato trovato
            },

            loadProducts: function() {
                var oModel = new ODataModel(url_oData);

                var aFilters = [];
                var oFilter = new Filter("UnitsInStock", FilterOperator.NE, 0);
                aFilters.push(oFilter);
            
                this.fetchDataFromOData("Products", oModel, aFilters, null).then(function(oData) 
                {
                    oData.results.forEach(function(product) {
                        // Aggiungi una nuova proprietà TotalPrice inizializzata a zero per ogni prodotto
                        product.TotalPrice = 0;
                    });
            
                    // Imposta i dati dei prodotti nel modello JSON
                    var oProductsModel = new JSONModel(oData.results);
                    this.getView().setModel(oProductsModel, "productsTableModel");

                    // Imposta il modello dei prodotti selezionati (vuoto) nello Step2
                    var oSelectedProductsModel = new JSONModel([]);
                    this.getView().setModel(oSelectedProductsModel, "selectedProductsModel");
                }.bind(this)).catch(function(error) {
                    console.error("Errore durante il recupero dei dati dei prodotti:", error);
                });
            },

            SetValueMaximumQuantityStepInput: function(oEvent)
            {
                var oInput = oEvent.getSource();
                var iNewValue = parseInt(oInput.getValue());
                var oRowContext = oInput.getBindingContext("productsTableModel");
                var iUnitsInStock = parseInt(oRowContext.getProperty("UnitsInStock"));
            
                // Verifica se il nuovo valore supera il valore di UnitsInStock
                if (iNewValue > iUnitsInStock) {
                    // Se il nuovo valore supera il valore di UnitsInStock, reimposta il valore dello StepInput al valore massimo consentito
                    oInput.setValue(iUnitsInStock);
                    MessageBox.error("La quantità inserita supera le unità disponibili in magazzino.");
                }  
            },

            onCalculateTotalPrice: function(oEvent) {
                this.SetValueMaximumQuantityStepInput(oEvent);
            
                var oInput = oEvent.getSource(); // Ottieni l'oggetto StepInput che ha generato l'evento
                var fQuantity = parseFloat(oInput.getValue()); // Ottieni la quantità dal valore dell'input

                var oSelectedItem = oInput.getParent(); // Ottieni direttamente l'elemento selezionato
            
                // Ottieni l'indice dell'elemento selezionato
                var iSelectedIndex = this.getView().byId("productsTable").indexOfItem(oSelectedItem);
            
                // Ottieni il modello dei prodotti
                var oProductsModel = this.getView().getModel("productsTableModel");
            
                // Ottieni il prezzo unitario per l'elemento corrente
                var fUnitPrice = parseFloat(oProductsModel.getProperty("/")[iSelectedIndex].UnitPrice);
            
                // Calcola il prezzo totale moltiplicando la quantità per il prezzo unitario
                var fTotalPrice = fQuantity * fUnitPrice;
            
                // Aggiorna la proprietà "Prezzo totale" nel modello dei prodotti per l'elemento selezionato
                oProductsModel.setProperty("/" + iSelectedIndex + "/TotalPrice", fTotalPrice);
            
                // Ottieni l'oggetto del prodotto selezionato
                var oProduct = oProductsModel.getProperty("/")[iSelectedIndex];
            
                // Aggiungi proprietà aggiuntive all'oggetto del prodotto
                oProduct.Quantity = fQuantity;
                oProduct.TotalPrice = fTotalPrice;
            
                // Ottieni il modello JSON dei prodotti nello Step4
                var oSelectedProductsModel = this.getView().getModel("selectedProductsModel");

                // Verifica se il prodotto è già presente nella lista in base all'ID del prodotto
                var existingProductIndex = aSelectedProducts.findIndex(function(product) {
                    return product.ProductID === oProduct.ProductID;
                });

                // Se il prodotto è già presente nella lista, aggiorna solo la quantità e il prezzo totale
                if (existingProductIndex !== -1) 
                {
                    var existingProduct = aSelectedProducts[existingProductIndex];
                    existingProduct.Quantity = fQuantity;
                    existingProduct.TotalPrice = fTotalPrice;
                } 
                else 
                {
                    // Altrimenti, aggiungi il prodotto alla lista dei prodotti selezionati
                    aSelectedProducts.push({
                        ProductID: oProduct.ProductID,
                        ProductName: oProduct.ProductName,
                        UnitsInStock: oProduct.UnitsInStock,
                        UnitPrice: oProduct.UnitPrice,
                        Quantity: fQuantity,
                        TotalPrice: fTotalPrice
                    });
                }

                this.calculateSumTotalPrices(aSelectedProducts, oSelectedProductsModel);
            
                // Aggiorna il modello JSON dei prodotti nello Step4 con la nuova lista dei prodotti selezionati
                oSelectedProductsModel.setProperty("/", aSelectedProducts);
            },

            calculateSumTotalPrices: function(aSelectedProducts, oSelectedProductsModel)
            {
                // Inizializza la variabile per la somma dei prezzi totali
                var sumTotalPrices = 0;

                // Itera su ogni prodotto selezionato
                aSelectedProducts.forEach(function(product) {
                    // Verifica se la proprietà TotalPrice è definita e se è un numero valido
                    if (product.TotalPrice && !isNaN(product.TotalPrice)) {
                        // Aggiungi il prezzo totale del prodotto alla somma totale
                        sumTotalPrices += parseFloat(product.TotalPrice);
                    }
                });

                // Aggiorna la proprietà "SumTotalPrices" nel modello dei prodotti selezionati nello Step4
                oSelectedProductsModel.setProperty("/SumTotalPrices", sumTotalPrices);
            },

            loadCustomers: function() {
                var oModel = new ODataModel(url_oData);
            
                this.fetchDataFromOData("Customers", oModel, null, null).then(function(oData) 
                {
                    // Imposta i dati dei dipendenti nel modello JSON
                    var oCustomersModel = new JSONModel(oData.results);
                    this.getView().setModel(oCustomersModel, "customersTableModel");
                }.bind(this)).catch(function(error) {
                    console.error("Errore durante il recupero dei dati dei prodotti:", error);
                });
            },

            onCustomerSelectionChange: function(oEvent) {
                // Ottieni l'elemento selezionato nella tabella dei clienti
                var oSelectedItem = oEvent.getParameter("listItem");
                
                // Ottieni il binding context dell' elemento selezionato
                var oBindingContext = oSelectedItem.getBindingContext("customersTableModel");
                
                // Estrai i dati del cliente dal binding context
                var sCustomerId = oBindingContext.getProperty("CustomerID");
                var sCompanyName = oBindingContext.getProperty("CompanyName");
                var sContactName = oBindingContext.getProperty("ContactName");
                var sCity = oBindingContext.getProperty("City");
                var sCountry = oBindingContext.getProperty("Country");
                var sPhone = oBindingContext.getProperty("Phone");
                
                // Creazione del modello JSON per memorizzare i dati del cliente selezionato
                var oCustomerModel = new JSONModel({
                    customerId: sCustomerId,
                    companyName: sCompanyName,
                    contactName: sContactName,
                    location: sCity + " " + sCountry,
                    phone: sPhone
                });
                
                // Ottieni il fragment dello Step4 dalla vista
                var oStep4Fragment = this.byId("step4").getContent()[0];
               
                // Imposta il modello JSON sul fragment dello Step4
                oStep4Fragment.setModel(oCustomerModel, "selectedCustomerModel");
            },

            // Funzione per pulire tutte le schermate
            clearAllScreens: function() {
                // Pulisci lo Step 1
                this.getView().byId("valueHelpSearchEmployeer").setValue("");
                this.getView().byId("firstNameText").setText("");
                this.getView().byId("lastNameText").setText("");
                this.getView().byId("hireDateText").setText("");
                this.getView().byId("titleText").setText("");

                // Pulisci lo Step 2
                var oProductsModel = new JSONModel([]);
                this.getView().setModel(oProductsModel, "productsTableModel");
                this.getView().byId("productsTable").removeSelections();

                // Pulisci lo Step 3
                var oCustomersModel = new JSONModel([]);
                this.getView().setModel(oCustomersModel, "customersTableModel");
                this.getView().byId("customersTable").removeSelections();
            },

            onConfirmOrder: function() {
                var that = this; // Salva il contesto corrente
                var oVisibilityModel = this.getView().getModel("visibilityModel");
                var oStepContainer = this.getView().byId("Page").getContent();
                
                // Apri la MessageBox con il messaggio di conferma
                MessageBox.confirm("Confermare il suo ordine?", {
                    title: "Conferma ordine",
                    onClose: function(oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            // Se l'utente conferma l'ordine, pulisci tutte le schermate e riportalo allo Step 1
                            that.clearAllScreens();
                            
                            // Imposta la visibilità dei pulsanti
                            oVisibilityModel.setProperty("/nextButtonVisible", true);
                            oVisibilityModel.setProperty("/confirmButtonVisible", false);
                            
                            // Nascondi tutti gli Step tranne lo Step1
                            oStepContainer.forEach(function(panel, index) {
                                if (index !== 0) {
                                    panel.setVisible(false);
                                }
                            });
            
                            currentStepIndex = 0;
                        }
                    }
                });
            }
        });
    });


