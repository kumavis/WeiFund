/**
Template Controllers

@module Templates
**/

/**
The balance template

@class [template] components_startCampaign
@constructor
**/
    
// Current account
var accountIndex = 0;

Template['components_startCampaign'].rendered = function(){
	// Form Validation
	$('#startCampaignForm').parsley({
		successClass: "has-success",
		errorClass: "has-error",
		classHandler: function (el) {
			return el.$element.closest(".form-group");
		},
		errorsContainer: function (el) {
			return el.$element.closest(".form-group");
		},
		errorsWrapper: "<span class='help-block'></span>",
		errorTemplate: "<span></span>"
	});
    
    // Set Default Start Campaign State
    TemplateVar.set('state', {isInactive: true});
	
	// Test IPFS hash and connection
	ipfs.cat('QmekvvCfcQg3LXXtUGeGy3kU4jGwg82txuZtVNRE8BvY9W', function(err, result){
		if(err)
			return TemplateVar.set(template, 'state', {
				isError: true,
				name: "IPFS Testing",
				stage: 1,
				error: err
			});
		
		console.log(result);
	});
	
	//window.ParsleyUI.removeError(specificField, "myCustomError");
};

Template['components_startCampaign'].helpers({
    'load': function(){
        Meteor.setTimeout(function(){ //timeout hack.
            $('#timelimit').datetimepicker();
        }, 300);
    },
});

Template['components_startCampaign'].events({
    
    'keyup #beneficiary': function(event, template){
        var accounts = EthAccounts.find({}).fetch();
        
        if(event.keyCode == 38) // up arrow
            accountIndex += 1;
        
        if(event.keyCode == 40) // down arrow
            accountIndex -= 1;
        
        if(accountIndex > accounts.length - 1)
            accountIndex = 0;
        
        if(accountIndex < 0)
            accountIndex = accounts.length - 1;
        
        if(event.keyCode == 38 || event.keyCode == 40)
            $('#beneficiary').val(accounts[accountIndex].address);
    },
        
    /**
    @method (click #backButton)
    **/
    
    'click #backButton': function(event, template){		
    	TemplateVar.set('state', {isInactive: true});
	},
        
    /**
    Fired when the start button is clicked. This starts the crowdfunding campaign.

    @method (click #start)
    **/
    
    'click #start': function(event, template){	
		if(!confirm("Are you sure you want to start a new campaign?"))
			return;
		
		try {
			var expiry = moment(Helpers.cleanAscii($('#timelimit').val())).unix(),
				name = Helpers.cleanAscii($('#name').val()),
				url = Helpers.cleanAscii($('#website').val()),
				beneficiary = Helpers.cleanAscii($('#beneficiary').val()),
				createWeiAccount = Helpers.cleanAscii($('#createWeiAccount').is(':checked')),
				config = Helpers.cleanAscii($('#config').val()),
				fundingGoal = web3.toWei(parseInt(Helpers.cleanAscii($('#fundingGoal').val())), 'ether'),
				category = Helpers.cleanAscii($('#category').val()),
				mainEntityOfPage = Helpers.cleanAscii($('#primaryContent').val()),
				banner = Helpers.cleanAscii($('#bannerImage').val()),
				avatar = Helpers.cleanAscii($('#avatarImage').val()),
				about = Helpers.cleanAscii($('#about').val()),
				description = Helpers.cleanAscii($('#description').val()),
				campaignID = null,
				campaignTransactionHash = '',
				registryTransactionHash = '';
			var ipfsHash = '',
				ipfsHashHex = '',
				transactionObject = {
					from: web3.eth.defaultAccount,
					gas: web3.eth.defaultGas,
				},
				bannerWidthMax = 960,
				bannerHeightMax = 360,
				avatarWidthMax = 400,
				avatarHeightMax = 400,
				ipfsObject = {
					campaignSchema: {
						id: 'latest',
						version: 1,
						name: name,
						alertnateName: '',
						url: url,
						beneficiary: beneficiary,
						config: config,
						fundingGoal: fundingGoal,
						category: category,
						owner: transactionObject.from,
						about: about,
						description: description,
						/*rewards: [
							{
								amountFloor: 0,
								name: '',
								description: '',
							}								
						],*/
						avatar: {
							'@type': 'ImageObject',
							'name': 'avatar',
             				'contentUrl' : avatar
						},
						banner: {
							'@type': 'ImageObject',
							'name': 'banner',
             				'contentUrl' : banner
						},
						mainEntityOfPage: {
							'@type': 'MediaObject',
							'name': 'mainEntity',
             				'contentUrl' : mainEntityOfPage
						}
					},
				},
				testIPFSHash = 'QmekvvCfcQg3LXXtUGeGy3kU4jGwg82txuZtVNRE8BvY9W',
				registryFilterObject = {
					_owner: transactionObject.from
				},
				filterObject = {
					_owner: transactionObject.from,
				};
	
			// Setup parsley fields data
			var beneficiaryField = $('#beneficiary').parsley(),
				configField = $('#config').parsley(),
				bannerField = $('#bannerImage').parsley(),
				avatarField = $('#avatarImage').parsley(),
				fundingField = $('#fundingGoal').parsley();
			
			console.log(createWeiAccount, beneficiaryField, configField, bannerField, avatarField,fundingField, $('#startCampaignForm'));

			// if config is empty fill with address polyfill
			if(config == '')
				config = web3.address(0);
			
			// check beneficiary address
			if(!web3.isAddress(beneficiary))
				return ParsleyUI.addError(beneficiaryField, "InvalidAddress", 'Your beneficiary address must be a real ethereum account');
			else
				ParsleyUI.removeError(beneficiaryField, "InvalidAddress");
			
			// check config contract address
			if(!web3.isAddress(config))
				return ParsleyUI.addError(beneficiaryField, "InvalidAddress", 'Your config contract address must be a real ethereum account');
			else
				ParsleyUI.removeError(beneficiaryField, "InvalidAddress");
			
			// Backup IPFS Data as Latest (no campaign ID yet) for emergency recovery
			IPFS_Backup.upsert({'campaignSchema.id': 'latest'}, ipfsObject);
			
			// check banner image height and width
			/*var bannerImage = new Image();
			bannerImage.src = banner;
			bannerImage.onload = function(){
				if(bannerImage.height > bannerHeightMax || bannerImage.width > bannerWidthMax)
					return ParsleyUI.addError(bannerField, "InvalidBanner", 'Your banner image must be ' + bannerHeightMax + ' pixels in width and ' + bannerWidthMax + ' pixels in height.');
				else
					ParsleyUI.removeError(bannerField, "InvalidBanner");
			};
			
			// check avatar height and width
			var avatarImage = new Image();
			avatarImage.src = avatar;
			avatarImage.onload = function(){
				if(avatarImage.height > avatarHeightMax || avatarImage.width != avatarImage.height)
					return ParsleyUI.addError(avatarField, "InvalidAvatar", 'Your avatar image must be square and below or equal to ' + avatarHeightMax + ' pixels in width and ' + avatarHeightMax + ' pixels in height.');
				else
					ParsleyUI.removeError(avatarField, "InvalidAvatar");
			};*/

			// Validate form Data
			$('#startCampaignForm')
				.parsley()
				.subscribe('parsley:form:validate', function (formInstance) {

				// If the form is valid
				if (formInstance.isValid('block1', true) && formInstance.isValid('block2', true)) {
						/*TemplateVar.set(template, 'state', {
								isError: true,
								name: "Campaign Data Structuring",
								stage: 0,
								error: "The campaign data you submitted is not valid. Please submit campaign data that is valid."
							});*/

					TemplateVar.set(template, 'state', {
						isProcessing: true,
						stage: 1,
						name: "IPFS Testing",
					});

					// Test IPFS Connection
					ipfs.cat(testIPFSHash, function(err, result){
						if(err)
							return TemplateVar.set(template, 'state', {
								isError: true,
								name: "IPFS Testing",
								stage: 1,
								error: err
							});
		
						// Prevent Double Click
						$(event.currentTarget).prop('disabled', true);
						
						TemplateVar.set(template, 'state', {
							isProcessing: true,
							stage: 1,
							name: "Processing New Campaign",
						});

						// Send New Campaign Transaction
						objects.contracts.WeiFund.newCampaign(name, beneficiary, fundingGoal, expiry, config, transactionObject, function(err, result){
							if(err)
								return TemplateVar.set(template, 'state', {
									isError: true, 
									name: "Processing New Campaign",
									stage: 2,
									error: err
								});

							campaignTransactionHash = result;

							TemplateVar.set(template, 'state', {
								isProcessing: true,
								stage: 2,
								name: "Processing New Campaign",
								campaignTransactionHash: result
							});
						});

						// Wait for New Campaign Event
						objects.contracts.WeiFund.CampaignCreated(filterObject, function(err, result){
							if(err)
								return TemplateVar.set(template, 'state', {
									isError: true, 
									name: "Waiting on Campaign Creation",
									stage: 3,
									campaignTransactionHash: campaignTransactionHash,
									error: err
								});

							campaignID = result.args._campaignID.toString();

							TemplateVar.set(template, 'state', {
								isProcessing: true,
								name: "Waiting on Campaign Creation",
								stage: 3,
								campaignID: campaignID,
								campaignTransactionHash: campaignTransactionHash
							});

							ipfsObject.campaignSchema.id = campaignID;
							ipfsObject.campaignSchema.created = moment().unix();

							// Backup IPFS Data
							IPFS_Backup.upsert({campaignSchema: {id: campaignID}}, ipfsObject);

							// Add IPFS Object to IPFS
							ipfs.addJson(ipfsObject, function(err, ipfsHash){
								if(err)
									return TemplateVar.set(template, 'state', {
										isError: true, 
										name: "Processing IPFS Data",
										stage: 4,
										campaignID: campaignID,
										campaignTransactionHash: campaignTransactionHash,
										error: err.Message
									});

								ipfsHash = ipfsHash;
								ipfsHashHex = '0x' + ipfs.utils.base58ToHex(ipfsHash);

								TemplateVar.set(template, 'state', {
									isProcessing: true,
									name: "Processing IPFS Data",
									stage: 4,
									campaignID: campaignID,
									campaignTransactionHash: campaignTransactionHash,
									ipfsHash: ipfsHash,
									ipfsHashHex: ipfsHashHex,
								});

								// Register IPFS Hash with WeiHash
								objects.contracts.WeiHash.register(campaignID, ipfsHashHex, function(err, result){
									if(err)
										return TemplateVar.set(template, 'state', {
											isError: true, 
											name: "Registering IPFS Hash with WeiHash",
											stage: 5,
											campaignID: campaignID,
											campaignTransactionHash: campaignTransactionHash,
											ipfsHash: ipfsHash,
											ipfsHashHex: ipfsHashHex,
											error: err
										});

									registryTransactionHash = result;

									TemplateVar.set(template, 'state', {
										isProcessing: true,
										stage: 5,
										name: "Registering IPFS Hash with WeiHash",
										campaignID: campaignID,
										campaignTransactionHash: campaignTransactionHash,
										registryTransactionHash: registryTransactionHash,
										ipfsHash: ipfsHash,
										ipfsHashHex: ipfsHashHex,
									});
								});

								// Wait for WeiHash Registry Event
								objects.contracts.WeiHash.HashRegistered(registryFilterObject, function(err, result){
									if(err)
										return TemplateVar.set(template, 'state', {
											isError: true, 
											name: "Waiting for WeiHash Registration",
											stage: 6,
											campaignID: campaignID,
											campaignTransactionHash: campaignTransactionHash,
											registryTransactionHash: registryTransactionHash,
											ipfsHash: ipfsHash,
											ipfsHashHex: ipfsHashHex,
											error: err
										});

									TemplateVar.set(template, 'state', {
										isProcessed: true,
										stage: 6,
										name: "Campaign Successfully Created!",
										campaignID: campaignID,
										campaignTransactionHash: campaignTransactionHash,
										registryTransactionHash: registryTransactionHash,
										ipfsHash: ipfsHash,
										ipfsHashHex: ipfsHashHex,
									});
									
									// register WeiAccounts address
									var weiAccountsfilterObject = {
											_campaignID: campaignID,
										};
									
									if(!createWeiAccount)
										return TemplateVar.set(template, 'state', {
												isProcessed: true,
												stage: 7,
												name: "Bypass contribution account generation",
												campaignID: campaignID,
												campaignTransactionHash: campaignTransactionHash,
												registryTransactionHash: registryTransactionHash,
												ipfsHash: ipfsHash,
												ipfsHashHex: ipfsHashHex,
											});

									// create new campaign account
									objects.contracts.WeiAccounts.newCampaignAccount(campaignID, transactionObject, function(err, accountTransactionHash){
										if(err)
											return TemplateVar.set(template, 'state', {
												isError: true, 
												name: "Waiting for contribution account creation...",
												stage: 7,
												campaignID: campaignID,
												campaignTransactionHash: campaignTransactionHash,
												registryTransactionHash: registryTransactionHash,
												ipfsHash: ipfsHash,
												ipfsHashHex: ipfsHashHex,
												error: err
											});

										// set new account state
										TemplateVar.set(template, 'state', {
											isProcessed: true,
											stage: 7,
											name: "Waiting for contribution account creation...",
											campaignID: campaignID,
											campaignTransactionHash: campaignTransactionHash,
											registryTransactionHash: registryTransactionHash,
											accountsTransactionHash: accountTransactionHash,
											ipfsHash: ipfsHash,
											ipfsHashHex: ipfsHashHex,
										});
									});

									// listen for new campaign account
									objects.contracts.WeiAccounts.AccountCreated(weiAccountsfilterObject, function(err, accountResult){
										if(err)
											return TemplateVar.set(template, 'state', {
												isError: true, 
												name: "Waiting for contribution account creation...",
												stage: 7,
												campaignID: campaignID,
												campaignTransactionHash: campaignTransactionHash,
												registryTransactionHash: registryTransactionHash,
												ipfsHash: ipfsHash,
												ipfsHashHex: ipfsHashHex,
												error: err
											});

										// set new account state
										TemplateVar.set(template, 'state', {
											isProcessed: true,
											stage: 7,
											name: "Campaign Contribution Account Created!",
											campaignID: campaignID,
											campaignTransactionHash: campaignTransactionHash,
											registryTransactionHash: registryTransactionHash,
											accountsTransactionHash: accountResult.transactionHash,
											ipfsHash: ipfsHash,
											ipfsHashHex: ipfsHashHex,
										});
									});
								});
							});
						});
					});
				}
				
				// Prevent Form Submit
				formInstance.submitEvent.preventDefault();	
			});
		}catch(err){
			return TemplateVar.set(template, 'state', {
				isError: true, 
				name: "Critical Code",
				error: err
			});
		}
    },
});