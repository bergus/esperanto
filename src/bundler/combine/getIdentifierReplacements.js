import topLevelScopeConflicts from './topLevelScopeConflicts';

/**
 * Figures out which identifiers need to be rewritten within
 * a bundle to avoid conflicts
 * @param {object} bundle - the bundle
 * @returns {object}
 */
export default function getIdentifiers ( bundle ) {
	var conflicts, identifiers = {};

	// first, discover conflicts
	conflicts = topLevelScopeConflicts( bundle );

	bundle.modules.forEach( mod => {
		var prefix, moduleIdentifiers, x;

		prefix = bundle.uniqueNames[ mod.id ];

		identifiers[ mod.id ] = moduleIdentifiers = {};

		function addName ( n ) {
			moduleIdentifiers[n] = {
				name: conflicts.hasOwnProperty( n ) ?
					prefix + '__' + n :
					n
			};
		}

		mod.ast._scope.names.forEach( addName );
		mod.ast._blockScope.names.forEach( addName );

		mod.imports.forEach( x => {
			var external;

			if ( x.passthrough ) {
				return;
			}

			if ( bundle.externalModuleLookup.hasOwnProperty( x.id ) ) {
				external = true;
			}

			x.specifiers.forEach( s => {
				var moduleId, mod, moduleName, specifierName, name, replacement, hash, isChained, separatorIndex;

				moduleId = x.id;
				mod = bundle.moduleLookup[ moduleId ];

				if ( s.batch ) {
					name = s.name;
					replacement = bundle.uniqueNames[ moduleId ];
				} else {
					name = s.as;
					specifierName = s.name;

					// If this is a chained import, get the origin
					hash = moduleId + '@' + specifierName;
					while ( bundle.chains.hasOwnProperty( hash ) ) {
						hash = bundle.chains[ hash ];
						isChained = true;
					}

					if ( isChained ) {
						separatorIndex = hash.indexOf( '@' );
						moduleId = hash.substr( 0, separatorIndex );
						specifierName = hash.substring( separatorIndex + 1 );
					}

					moduleName = bundle.uniqueNames[ moduleId ];

					if ( specifierName === 'default' ) {
						// if it's an external module, always use __default
						if ( bundle.externalModuleLookup[ moduleId ] ) {
							replacement = moduleName + '__default';
						}

						else if ( mod && mod.defaultExport && mod.defaultExport.declaration && mod.defaultExport.name ) {
							replacement = conflicts.hasOwnProperty( mod.defaultExport.name ) ?
								moduleName + '__' + mod.defaultExport.name :
								mod.defaultExport.name;
						}

						else {
							replacement = conflicts.hasOwnProperty( moduleName ) ?
								moduleName + '__default' :
								moduleName;
						}
					} else if ( !external ) {
						replacement = conflicts.hasOwnProperty( specifierName ) ?
							moduleName + '__' + specifierName :
							specifierName;
					} else {
						replacement = moduleName + '.' + specifierName;
					}
				}

				moduleIdentifiers[ name ] = {
					name: replacement,
					readOnly: true
				};
			});
		});

		// TODO is this necessary? Or only necessary in with default
		// exports that are expressions?
		if ( x = mod.defaultExport ) {
			if ( x.declaration && x.name ) {
				moduleIdentifiers.default = {
					name: conflicts.hasOwnProperty( x.name ) ?
						prefix + '__' + x.name :
						x.name
				};
			} else {
				moduleIdentifiers.default = {
					name: conflicts.hasOwnProperty( prefix ) ?
						prefix + '__default' :
						prefix
				};
			}
		}
	});

	return identifiers;
}