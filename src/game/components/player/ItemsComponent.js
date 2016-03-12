define(['ash', 'game/vos/ItemVO', 'game/constants/ItemConstants'],
function (Ash, ItemVO, ItemConstants) {
    var ItemsComponent = Ash.Class.extend({
        
        items: {},
        
        capacity: -1,
        uniqueItemsAll: {},
        uniqueItemsCarried: {},
        selectedItem: null,
        
        constructor: function () {
            this.items = {};
            this.items[ItemConstants.itemTypes.light] = [];
            this.items[ItemConstants.itemTypes.shades] = [];
            this.items[ItemConstants.itemTypes.weapon] = [];
            this.items[ItemConstants.itemTypes.clothing] = [];
            this.items[ItemConstants.itemTypes.follower] = [];
        },
        
        addItem: function (item, isCarried) {
            if (item) {
                if (typeof this.items[item.type] == 'undefined') {
                    this.items[item.type] = [];
                }
                
                var currentCount = this.getCountById(item.id, true);
                if (this.capacity <= 0 || currentCount + 1 <= this.capacity) {
                    this.items[item.type].push(item);
                    if (item.equippable) this.autoEquip(item);
                    item.carried = isCarried;
                    this.uniqueItemsCarried = {};
                    this.uniqueItemsAll = {};
                } else {
                    console.log("WARN: Trying to add item but the bag is full. (id:" + item.id + ", capacity: " + this.capacity + ")");
                }
            } else {
                console.log("WARN: Trying to add undefined item.");
            }
        },
        
        discardItem: function (item) {
            if (!item) console.log("WARN: Trying to discard null item.");
            if (!this.isItemDiscardable(item)) {
                console.log("WARN: Trying to discard un-discardable item.");
                return;
            }
            
            // TODO prefer carried items when discarding
            
            if (typeof this.items[item.type] !== 'undefined') {
                var typeItems = this.items[item.type];
                var splicei = -1;
                for (var i = 0; i < typeItems.length; i++) {
                    if (typeItems[i].id === item.id) {
                        splicei = i;
                        break;
                    }
                }
                if (splicei >= 0) {
                    typeItems.splice(splicei, 1);
                    if (item.equipped) {
                        var nextItem = this.getSimilar(item);
                        if (nextItem) this.equip(nextItem);
                    }
                } else {
                    console.log("WARN: Item to discard not found.");
                }
            }
            this.uniqueItemsCarried = {};
            this.uniqueItemsAll = {};
        },
        
        discardItems: function (item) {
            var count;
            var keepOne = !this.isItemsDiscardable(item);
            var target = keepOne ? 1 : 0;
            do {
                this.discardItem(item);
                count = this.getCount(item, true);
            } while (count > target);
        },
        
        isItemDiscardable: function (item) {
            return this.isItemsDiscardable(item) || this.getCount(item, true) > 1;
        },
        
        isItemsDiscardable: function (item) {
            switch (item.type) {
                case ItemConstants.itemTypes.bag:
                    return this.getStrongestByType(item.type).id !== item.id;
                
                case ItemConstants.itemTypes.uniqueEquipment:
                    return false;
                
                default: return true;
            }
        },
        
        isItemObsolete: function (item) {
            if (!item.equippable) return false;
            
            var currentBonus = this.getCurrentBonus(item.type);
            return item.bonus <= currentBonus;
        },
        
        // Equips the given item if it's better than the previous equipment
        autoEquip: function (item) {
            var shouldEquip = item.equippable;
            
            if (shouldEquip) {
                for (var i = 0; i < this.items[item.type].length; i++) {
                    var existingItem = this.items[item.type][i];
                    if (existingItem.itemID === item.itemID) continue;
                    if (existingItem.equipped && !(this.isItemMultiEquippable(existingItem) && this.isItemMultiEquippable(item))) {
                        var isExistingBonusBetter = existingItem.bonus >= item.bonus;
                        if (!isExistingBonusBetter) {
                            this.unequip(existingItem);
                        }
                        if (isExistingBonusBetter) {
                            shouldEquip = false;
                        }
                    }
                }
            }
            
            if (shouldEquip) this.equip(item);
            else item.equipped = false;
            
            this.uniqueItemsCarried = {};
            this.uniqueItemsAll = {};
        },
        
        isItemMultiEquippable: function (item) {
            return item.type === ItemConstants.itemTypes.follower;
        },
        
        isItemUnequippable: function (item) {
            return item.type !== ItemConstants.itemTypes.follower;
        },
        
        // Equips the given item regardless of whether it's better than the previous equipment
        equip: function (item) {
            if (item.equippable) {
                var previousItems = this.getEquipped(item.type);
            
                for (var i = 0; i < previousItems.length; i++) {
                    var previousItem = previousItems[i];
                    if (previousItem && previousItem !== item) {
                        if (!(this.isItemMultiEquippable(item) && this.isItemMultiEquippable(previousItem))) {
                            this.unequip(previousItem);
                        }
                    }
                }
                item.equipped = true;
            }
            this.uniqueItemsCarried = {};
            this.uniqueItemsAll = {};
        },
        
        unequip: function (item) {
            if (this.isItemUnequippable(item)) {
                item.equipped = false;
                this.uniqueItemsCarried = {};
                this.uniqueItemsAll = {};
            }
        },
        
        getEquipped: function (type) {
            var equipped = [];
            for (var key in this.items) {
                if (key == type || !type) {
                    for( var i = 0; i < this.items[key].length; i++) {
                        var item = this.items[key][i];
                        if (item.equipped) equipped.push(item);
                    }
                }
            }
            return equipped.sort(this.itemSortFunction);
        },
        
        getCurrentBonus: function (type) {
            var bonus = 0;
            for (var key in this.items) {
                if (key === type) {
                    for (var i = 0; i < this.items[key].length; i++) {
                        var item = this.items[key][i];
                        if (item.equipped) return item.bonus;
                    }
                }
            }
            return bonus;
        },
        
        getAll: function (includeNotCarried) {
            var all = [];
            var item;
            for (var key in this.items) {
                for (var i = 0; i < this.items[key].length; i++) {
                    item = this.items[key][i];
                    if (includeNotCarried || item.carried) all.push(item);
                }
            }
            return all.sort(this.itemSortFunction);
        },
        
        getUnique: function (includeNotCarried) {
            var all = {};
            var allList = [];
            for (var key in this.items) {
                for( var i = 0; i < this.items[key].length; i++) {
                    var item = this.items[key][i];
                    if (includeNotCarried || item.carried) {
                        var itemKey = item.id;
                        if (all[itemKey]) {
                            all[itemKey] = all[itemKey] + 1;
                        } else {
                            all[itemKey] = 1;
                            allList.push(item);
                        }
                    }
                }
            }
            
            if (includeNotCarried) {
                this.uniqueItemsAll = all;
            } else {
                this.uniqueItemsCarried = all;
            }
            
            return allList.sort(this.itemSortFunction);
        },
        
        getCount: function (item, includeNotCarried) {
            if (!item) return 0;
            if (Object.keys(includeNotCarried ? this.uniqueItemsAll : this.uniqueItemsCarried).length <= 0) this.getUnique();
            var itemKey = item.id;
            return this.getCountById(itemKey, includeNotCarried);
        },
        
        getCountById: function (id, includeNotCarried) {
            if (Object.keys(includeNotCarried ? this.uniqueItemsAll : this.uniqueItemsCarried).length <= 0) this.getUnique();
            if (includeNotCarried)
                return typeof this.uniqueItemsAll[id] === 'undefined' ? 0 : this.uniqueItemsAll[id];
            else
                return typeof this.uniqueItemsCarried[id] === 'undefined' ? 0 : this.uniqueItemsCarried[id];
        },
        
        getCountByType: function (type) {
            return this.items[type].length;
        },
        
        getWeakestByType: function (type) {
            var weakest = null;
            for (var i = 0; i < this.items[type].length; i++) {
                var item = this.items[type][i];
                if (!weakest || item.bonus < weakest.bonus) weakest = item;
            }
            return weakest;
        },
        
        getStrongestByType: function (type) {
            var strongest = null;
            for (var i = 0; i < this.items[type].length; i++) {
                var item = this.items[type][i];
                if (!strongest || item.bonus > strongest.bonus) strongest = item;
            }
            return strongest;
        },
        
        getItem: function (id, instanceId) {
            for (var key in this.items) {
                for( var i = 0; i < this.items[key].length; i++) {
                    var item = this.items[key][i];
                    if(id == item.id && (!instanceId || instanceId == item.itemID)) return item;
                }
            }
            return null;
        },
        
        getSimilar: function (item) {
            for (var key in this.items) {
                for( var i = 0; i < this.items[key].length; i++) {
                    var otherItem = this.items[key][i];
                    if (item.itemID != otherItem.itemID && item.id == otherItem.id) {
                        return otherItem;
                    }
                }
            }
            return null;
        },
        
        contains: function (name) {
            for (var key in this.items) {
                for( var i = 0; i < this.items[key].length; i++) {
                    if(this.items[key][i].name == name) return true;
                }
            }
            return false;
        },
        
        itemSortFunction: function(a, b) {
            if (!a.equipped && b.equipped) return 1;
            if (a.equipped && !b.equipped) return -1;
            if (!a.equippable && b.equippable) return 1;
            if (a.equippable && !b.equippable) return -1;
            if (a.type > b.type) return 1;
            if (a.type < b.type) return -1;
            return b.bonus - a.bonus;
        },
        
        customLoadFromSave: function (componentValues) {
            for(var key in componentValues.items) {
                for (var i in componentValues.items[key]) {
                    var itemID = componentValues.items[key][i].id;
                    var item = ItemConstants.getItemByID(itemID);
                    if (item) {
                        item.carried = componentValues.items[key][i].carried;
                        this.addItem(item, item.carried);
                    }
                }
            }
        }
    });

    return ItemsComponent;
});
